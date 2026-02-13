import crypto from "node:crypto";
import AppError from "../lib/AppError";
import userRepository from "../repositories/user.repository";
import externalAccountsRepository from "../repositories/external-accounts.repository";
import transferRepository from "../repositories/transfer.repository";
import activityLogger from "../lib/activity-logger";
import { ActivityStatus, ActivityType } from "../generated/prisma/client";
import type {
  SimulateTransferInput,
  TransferInput,
} from "../schemas/transfer.schema";

// In-memory cache for executionId→userId mapping with TTL
// Entries expire after 30 minutes (Zynk validUntil is typically shorter)
const EXECUTION_CACHE_TTL_MS = 30 * 60 * 1000;
const EXECUTION_CACHE_MAX_SIZE = 10000; // Prevent unbounded memory growth
const executionOwnershipCache = new Map<
  string,
  { userId: string; expiresAt: number; activityId?: string }
>();

// Cleanup expired entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of executionOwnershipCache) {
    if (value.expiresAt < now) {
      executionOwnershipCache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

// Export for graceful shutdown
export function stopCacheCleanup() {
  clearInterval(cleanupInterval);
}

// Enforce max cache size by removing oldest entries
function enforceMaxCacheSize() {
  if (executionOwnershipCache.size <= EXECUTION_CACHE_MAX_SIZE) return;

  // Remove oldest entries (first inserted = first in Map iteration)
  const entriesToRemove = executionOwnershipCache.size - EXECUTION_CACHE_MAX_SIZE;
  let removed = 0;
  for (const key of executionOwnershipCache.keys()) {
    if (removed >= entriesToRemove) break;
    executionOwnershipCache.delete(key);
    removed++;
  }
}

class TransferService {
  async simulateTransfer(userId: string, data: SimulateTransferInput) {
    // Get user and validate zynkEntityId
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(400, "User must complete KYC before making transfers");
    }

    // Find user's wallet external account (source account)
    const sourceAccount =
      await externalAccountsRepository.findNonCustodialAccount(userId);
    if (!sourceAccount) {
      throw new AppError(
        400,
        "User does not have a wallet. Please create a wallet first."
      );
    }

    if (!sourceAccount.zynkExternalAccountId) {
      throw new AppError(400, "Source wallet is not properly configured");
    }

    // Find destination external account
    const destinationAccount = await externalAccountsRepository.findById(
      data.externalAccountId,
      userId
    );
    if (!destinationAccount) {
      throw new AppError(404, "Destination external account not found");
    }

    // Validate destination is withdrawal type
    if (destinationAccount.type !== "withdrawal") {
      throw new AppError(
        400,
        "Destination account must be a withdrawal type external account"
      );
    }

    if (!destinationAccount.zynkExternalAccountId) {
      throw new AppError(400, "Destination account is not properly configured");
    }

    // Generate transaction ID
    const transactionId = `txn_${crypto.randomUUID().replaceAll("-", "_")}`;

    // Determine amount (prefer exactAmountIn if both provided)
    const exactAmountIn = data.exactAmountIn;
    const exactAmountOut = data.exactAmountIn ? undefined : data.exactAmountOut;

    // Call Zynk simulate API
    const response = await transferRepository.simulateTransfer({
      transactionId,
      fromEntityId: user.zynkEntityId,
      fromAccountId: sourceAccount.zynkExternalAccountId,
      toEntityId: user.zynkEntityId,
      toAccountId: destinationAccount.zynkExternalAccountId,
      exactAmountIn,
      exactAmountOut,
      depositMemo: data.depositMemo,
    });

    // Store executionId→userId mapping for ownership validation.
    // Respect Zynk's validUntil window and also enforce a hard upper bound to avoid leaks.
    const now = Date.now();
    const zynkValidUntil = Date.parse(response.data.validUntil);
    const expiresAt = Number.isFinite(zynkValidUntil)
      ? Math.min(zynkValidUntil, now + EXECUTION_CACHE_TTL_MS)
      : now + EXECUTION_CACHE_TTL_MS;
    const cacheEntry = {
      userId,
      expiresAt,
    };

    // Best-effort activity log
    const amount =
      response.data.quote?.inAmount?.amount ??
      data.exactAmountIn ??
      data.exactAmountOut ??
      null;
    const activity = await activityLogger.logActivity({
      userId,
      type: ActivityType.TRANSFER,
      status: ActivityStatus.PENDING,
      amount: amount ?? undefined,
      description: "Transfer simulation initiated",
      metadata: {
        executionId: response.data.executionId,
        toExternalAccountId: destinationAccount.id,
        toZynkExternalAccountId: destinationAccount.zynkExternalAccountId,
        quote: response.data.quote,
        validUntil: response.data.validUntil,
      },
    });

    executionOwnershipCache.set(response.data.executionId, {
      ...cacheEntry,
      activityId: activity.id,
    });
    enforceMaxCacheSize();

    return {
      executionId: response.data.executionId,
      payloadToSign: response.data.payloadToSign,
      quote: response.data.quote,
      validUntil: response.data.validUntil,
    };
  }

  async transfer(userId: string, data: TransferInput) {
    // Validate that the user owns this executionId
    const ownership = executionOwnershipCache.get(data.executionId);
    if (!ownership) {
      throw new AppError(400, "Invalid or expired execution ID");
    }

    if (ownership.userId !== userId) {
      throw new AppError(403, "You do not have permission to execute this transfer");
    }

    // Check if expired
    if (ownership.expiresAt < Date.now()) {
      executionOwnershipCache.delete(data.executionId);
      throw new AppError(400, "Transfer execution has expired");
    }

    try {
      // Call Zynk transfer API
      const response = await transferRepository.executeTransfer({
        executionId: data.executionId,
        payloadSignature: data.signature,
        transferAcknowledgement: "true",
        signatureType: "ApiKey",
      });

      // Remove from cache after successful execution
      executionOwnershipCache.delete(data.executionId);

      if (ownership.activityId) {
        await activityLogger.markComplete(ownership.activityId, {
          description: "Transfer executed successfully",
          metadata: { message: response.data.message },
        });
      }

      return {
        executionId: response.data.executionId,
        message: response.data.message,
      };
    } catch (error) {
      if (ownership.activityId) {
        await activityLogger.markFailed(ownership.activityId, {
          description: "Transfer execution failed",
          metadata: { error: error instanceof Error ? error.message : error },
        });
      }
      throw error;
    }
  }
}

export default new TransferService();
