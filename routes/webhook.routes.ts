import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import userRepository from "../repositories/user.repository";
import zynkService from "../services/zynk.service";
import { kycEventSchema, type KYCEvent } from "../schemas/webhook.schema";
import activityLogger from "../lib/activity-logger";
import { ActivityStatus, ActivityType } from "../generated/prisma/client";

const router = express.Router();
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

type WebhookVerificationResult = {
  valid: boolean;
  error?: "invalid_format" | "expired" | "invalid_signature";
};

function verifyWebhookSignature(
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

  const body = JSON.stringify({ ...payload, signedAt: timestamp });
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
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
        await activityLogger.logActivity({
          userId: user.id,
          type:
            body.eventStatus === "rejected"
              ? ActivityType.KYC_REJECTED
              : ActivityType.KYC_FAILED,
          status: ActivityStatus.FAILED,
          description: "KYC not approved",
          metadata: body,
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

      // Update user status and create funding account
      // If either fails, return error to webhook so it can retry
      try {
        await userRepository.update(user.id, { accountStatus: "ACTIVE" });
        await zynkService.createFundingAccount(user.id);
      } catch (err) {
        // Log but don't throw - return 500 so webhook can retry
        await activityLogger.logActivity({
          userId: user.id,
          type: ActivityType.KYC_FAILED,
          status: ActivityStatus.FAILED,
          description: "Failed to activate account after KYC approval",
          metadata: { error: err instanceof Error ? err.message : String(err) },
        });
        throw new AppError(500, "Failed to complete account activation");
      }

      return res.status(200).json(new APIResponse(true, "Success"));
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
