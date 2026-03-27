import * as Sentry from "@sentry/node";
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { Webhook } from "svix";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import logger from "../lib/logger";
import userRepository from "../repositories/user.repository";
import { kycEventSchema, type KYCEvent } from "../schemas/webhook.schema";
import activityLogger from "../lib/activity-logger";
import notificationLogger from "../lib/notification-logger";
import { ActivityStatus, ActivityType, NotificationType } from "../generated/prisma/client";

const router = express.Router();
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

type WebhookVerificationResult = {
  valid: boolean;
  error?: "invalid_format" | "expired" | "invalid_signature";
};

function verifyWebhookSignature(
  rawBody: Buffer | undefined,
  payload: object,
  signatureHeader: string,
  secret: string
): WebhookVerificationResult {
  const match = /^(\d+):(.+)$/.exec(signatureHeader);
  if (!match?.[1] || !match?.[2]) {
    return { valid: false, error: "invalid_format" };
  }

  const timestamp = match[1];
  const signature = match[2];

  const timestampMs = Number.parseInt(timestamp, 10);
  if (Number.isNaN(timestampMs)) {
    return { valid: false, error: "invalid_format" };
  }

  const age = Date.now() - timestampMs;
  if (
    age > WEBHOOK_TIMESTAMP_TOLERANCE_MS ||
    age < -WEBHOOK_TIMESTAMP_TOLERANCE_MS
  ) {
    return { valid: false, error: "expired" };
  }

  // Use raw body if available to avoid JSON re-serialization issues,
  // otherwise fall back to re-serialized payload
  const bodyForHmac = rawBody
    ? rawBody.toString("utf8").replace(/}$/, `,"signedAt":"${timestamp}"}`)
    : JSON.stringify({ ...payload, signedAt: timestamp });
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(bodyForHmac)
    .digest("base64");

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, "base64"),
      Buffer.from(expectedSignature, "base64")
    );
    return isValid
      ? { valid: true }
      : { valid: false, error: "invalid_signature" };
  } catch {
    return { valid: false, error: "invalid_signature" };
  }
}

router.post(
  "/webhook",
  async (req: Request, res: Response, next: NextFunction) => {
    return Sentry.startSpan(
      { name: "webhook.kyc", op: "webhook" },
      async (span) => {
    try {
      const signatureHeader = req.headers["z-webhook-signature"];
      const secret = process.env.ZYNK_WEBHOOK_SECRET;

      if (!secret) {
        throw new AppError(500, "Webhook secret not configured");
      }

      if (!signatureHeader || typeof signatureHeader !== "string") {
        throw new AppError(401, "Missing webhook signature");
      }

      const verification = verifyWebhookSignature(
        (req as any).rawBody,
        req.body,
        signatureHeader,
        secret
      );
      if (!verification.valid) {
        const errorMessages: Record<
          NonNullable<typeof verification.error>,
          string
        > = {
          invalid_format: "Invalid webhook signature format",
          expired: "Webhook signature has expired",
          invalid_signature: "Invalid webhook signature",
        };
        throw new AppError(401, errorMessages[verification.error!]);
      }

      // Validate webhook payload to prevent prototype pollution and type confusion
      const { error, value } = kycEventSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(
          400,
          `Invalid webhook payload: ${error.details
            .map((d) => d.message)
            .join(", ")}`
        );
      }

      const body: KYCEvent = value;
      span.setAttribute("eventCategory", body.eventCategory);
      span.setAttribute("eventStatus", body.eventStatus);

      Sentry.addBreadcrumb({
        category: "webhook",
        message: `Webhook validated: ${body.eventCategory}/${body.eventStatus}`,
        level: "info",
        data: { eventCategory: body.eventCategory, eventStatus: body.eventStatus },
      });
      if (body.eventCategory !== "kyc") {
        return res.status(200).send(new APIResponse(true, "Event ignored"));
      }

      const user = await userRepository.findByZynkEntityId(
        body.eventObject.entityId
      );
      if (!user) throw new AppError(404, "User not found");

      if (
        body.eventStatus !== "approved" &&
        body.eventObject.status !== "approved"
      ) {
        const isRejected = body.eventStatus === "rejected";
        await activityLogger.logActivity({
          userId: user.id,
          type: isRejected
            ? ActivityType.KYC_REJECTED
            : ActivityType.KYC_FAILED,
          status: ActivityStatus.FAILED,
          description: "KYC not approved",
          metadata: body,
        });
        notificationLogger.notify({
          userId: user.id,
          type: isRejected
            ? NotificationType.KYC_REJECTED
            : NotificationType.KYC_FAILED,
          title: isRejected ? "KYC Rejected" : "KYC Failed",
          body: isRejected
            ? "Your identity verification was not approved. Please try again."
            : "Your identity verification encountered an issue. Please try again.",
        });
        return res.status(200).send(new APIResponse(true, "Event ignored"));
      }

      await activityLogger.logActivity({
        userId: user.id,
        type: ActivityType.KYC_APPROVED,
        status: ActivityStatus.COMPLETE,
        description: "KYC approved",
        metadata: body,
      });
      notificationLogger.notify({
        userId: user.id,
        type: NotificationType.KYC_APPROVED,
        title: "KYC Approved",
        body: "Your identity verification is complete. You can now link your bank account.",
      });

      // Update user status independently — this must succeed
      await userRepository.update(user.id, { accountStatus: "ACTIVE" });

      return res.status(200).json(new APIResponse(true, "Success"));
    } catch (error) {
      return next(error);
    }
      },
    );
  }
);

router.post(
  "/clerk-webhook",
  async (req: Request, res: Response, next: NextFunction) => {
    return Sentry.startSpan(
      { name: "webhook.clerk", op: "webhook" },
      async () => {
        try {
          const secret = process.env.CLERK_WEBHOOK_SECRET;
          if (!secret) {
            logger.warn("Clerk webhook received but CLERK_WEBHOOK_SECRET is not configured");
            return res.status(200).json(new APIResponse(true, "Webhook not configured"));
          }

          const svixId = req.headers["svix-id"] as string;
          const svixTimestamp = req.headers["svix-timestamp"] as string;
          const svixSignature = req.headers["svix-signature"] as string;

          if (!svixId || !svixTimestamp || !svixSignature) {
            return res.status(401).json(new APIResponse(false, "Missing webhook signature headers"));
          }

          const wh = new Webhook(secret);
          const body = (req as any).rawBody
            ? (req as any).rawBody.toString("utf8")
            : JSON.stringify(req.body);

          let event: { type: string; data: Record<string, unknown>; timestamp: number };
          try {
            event = wh.verify(body, {
              "svix-id": svixId,
              "svix-timestamp": svixTimestamp,
              "svix-signature": svixSignature,
            }) as typeof event;
          } catch {
            return res.status(401).json(new APIResponse(false, "Invalid webhook signature"));
          }

          if (event.type !== "user.updated") {
            return res.status(200).json(new APIResponse(true, "Event ignored"));
          }

          const passwordLastUpdatedAt = event.data.password_last_updated_at as number | undefined;
          const eventTimestamp = event.timestamp;
          const isPasswordChange =
            passwordLastUpdatedAt != null &&
            eventTimestamp != null &&
            Math.abs(passwordLastUpdatedAt - eventTimestamp) < 60000;

          if (!isPasswordChange) {
            return res.status(200).json(new APIResponse(true, "Event ignored"));
          }

          const clerkUserId = event.data.id as string;
          if (!clerkUserId) {
            return res.status(200).json(new APIResponse(true, "Event ignored"));
          }

          const user = await userRepository.findByClerkUserId(clerkUserId);
          if (!user) {
            logger.warn("Clerk webhook: user not found", { clerkUserId });
            return res.status(200).json(new APIResponse(true, "User not found"));
          }

          notificationLogger.notify({
            userId: user.id,
            type: NotificationType.PASSWORD_CHANGED,
            title: "Password Changed",
            body: "Your password was recently changed. If this wasn't you, please contact support immediately.",
          });

          return res.status(200).json(new APIResponse(true, "Password change notification sent"));
        } catch (error) {
          return next(error);
        }
      },
    );
  },
);

export default router;
