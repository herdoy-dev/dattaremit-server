import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../middlewares/auth";
import type { Prisma } from "../generated/prisma/client";
import prismaClient from "./prisma-client";
import { sha256 } from "./crypto";
import AppError from "./AppError";
import APIResponse from "./APIResponse";
import logger from "./logger";
import userService from "../services/user.service";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_HEADER = "idempotency-key";

export interface IdempotencyOptions {
  operation: string;
}

export type IdempotentHandlerResult<T> = {
  status: number;
  response: APIResponse<T>;
};

function extractIdempotencyKey(req: AuthRequest): string {
  const key = req.header(IDEMPOTENCY_HEADER);

  if (!key) {
    throw new AppError(400, `Missing required header: ${IDEMPOTENCY_HEADER}`);
  }

  if (key.length < 16 || key.length > 255) {
    throw new AppError(
      400,
      "Idempotency-Key must be between 16 and 255 characters"
    );
  }

  if (!/^[a-zA-Z0-9\-_]+$/.test(key)) {
    throw new AppError(400, "Idempotency-Key contains invalid characters");
  }

  return key;
}

async function lazyCleanup(): Promise<void> {
  try {
    const deleted = await prismaClient.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (deleted.count > 0) {
      logger.info(`Cleaned up ${deleted.count} expired idempotency keys`);
    }
  } catch (error) {
    logger.warn("Failed to cleanup expired idempotency keys", { error });
  }
}

async function checkOrCreate<T>(
  userId: string,
  operation: string,
  key: string,
  requestHash: string
): Promise<{
  isNew: boolean;
  cachedResponse?: { status: number; body: APIResponse<T> };
  recordId?: string;
}> {
  // Fire and forget lazy cleanup with logging
  lazyCleanup().catch((err) => {
    logger.warn("Idempotency cleanup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_MS);

  try {
    const existing = await prismaClient.idempotencyKey.findUnique({
      where: {
        userId_operation_key: {
          userId,
          operation,
          key,
        },
      },
    });

    if (existing) {
      // Check if expired
      if (existing.expiresAt < new Date()) {
        await prismaClient.idempotencyKey.delete({
          where: { id: existing.id },
        });
        // Fall through to create new record
      } else if (existing.status === "PENDING") {
        throw new AppError(
          409,
          "A request with this idempotency key is already in progress. Please retry later."
        );
      } else if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new AppError(
          422,
          "Idempotency key has already been used with a different request payload"
        );
      } else if (existing.status === "COMPLETED") {
        // Cast through unknown since Prisma's JsonValue doesn't overlap with APIResponse
        const cachedBody = existing.responseBody as unknown as APIResponse<T>;
        return {
          isNew: false,
          cachedResponse: {
            status: existing.responseStatus || 200,
            body: cachedBody,
          },
        };
      } else if (existing.status === "FAILED") {
        throw new AppError(
          existing.responseStatus || 500,
          existing.errorMessage || "Previous request failed"
        );
      }
    }

    // Create new PENDING record
    const record = await prismaClient.idempotencyKey.create({
      data: {
        key,
        userId,
        operation,
        requestHash,
        status: "PENDING",
        expiresAt,
      },
    });

    return {
      isNew: true,
      recordId: record.id,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    // Handle unique constraint violation (race condition)
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new AppError(
        409,
        "A request with this idempotency key is already in progress. Please retry later."
      );
    }

    // Fail closed - don't allow potentially duplicate operations
    logger.error("Idempotency check failed", {
      error,
      userId,
      operation,
      key,
    });

    throw new AppError(
      503,
      "Service temporarily unavailable. Please try again later."
    );
  }
}

async function markCompleted<T>(
  recordId: string | undefined,
  responseStatus: number,
  responseBody: APIResponse<T>
): Promise<void> {
  if (!recordId) return;

  try {
    // Convert APIResponse to Prisma-compatible JSON
    const jsonBody: Prisma.InputJsonValue = {
      success: responseBody.success,
      message: responseBody.message,
      data: responseBody.data as Prisma.InputJsonValue,
    };

    await prismaClient.idempotencyKey.update({
      where: { id: recordId },
      data: {
        status: "COMPLETED",
        responseStatus,
        responseBody: jsonBody,
      },
    });
  } catch (error) {
    logger.warn("Failed to mark idempotency record as completed", {
      error,
      recordId,
    });
  }
}

async function markFailed(
  recordId: string | undefined,
  responseStatus: number,
  errorMessage: string
): Promise<void> {
  if (!recordId) return;

  try {
    await prismaClient.idempotencyKey.update({
      where: { id: recordId },
      data: {
        status: "FAILED",
        responseStatus,
        errorMessage,
      },
    });
  } catch (error) {
    logger.warn("Failed to mark idempotency record as failed", {
      error,
      recordId,
    });
  }
}

export async function withIdempotency<T>(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  options: IdempotencyOptions,
  handler: () => Promise<IdempotentHandlerResult<T>>
): Promise<void> {
  try {
    const idempotencyKey = extractIdempotencyKey(req);

    const user = await userService.getByClerkUserId(req.user.clerkUserId);
    if (!user) {
      throw new AppError(401, "User not found");
    }

    const requestHash = await sha256(JSON.stringify(req.body || {}));

    const result = await checkOrCreate<T>(
      user.id,
      options.operation,
      idempotencyKey,
      requestHash
    );

    // Return cached response if exists
    if (!result.isNew && result.cachedResponse) {
      res.status(result.cachedResponse.status).json(result.cachedResponse.body);
      return;
    }

    // Execute the handler
    try {
      const { status, response } = await handler();

      await markCompleted(result.recordId, status, response);

      res.status(status).json(response);
    } catch (handlerError) {
      const errorStatus =
        handlerError instanceof AppError ? handlerError.status : 500;
      const errorMessage =
        handlerError instanceof Error ? handlerError.message : "Unknown error";

      await markFailed(result.recordId, errorStatus, errorMessage);

      throw handlerError;
    }
  } catch (error) {
    next(error);
  }
}
