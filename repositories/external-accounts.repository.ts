import prismaClient from "../lib/prisma-client";
import zynkClient from "../lib/zynk-client";
import AppError from "../lib/AppError";
import { handleZynkError } from "../lib/zynk-error";
import type { ExternalAccountStatus } from "../generated/prisma/client";

// ============================================
// Input Types
// ============================================

interface CreateExternalAccountInput {
  userId: string;
  walletAddress: string;
  label?: string;
  zynkExternalAccountId?: string;
  type?: string;
  walletId?: string;
}

interface ZynkExternalAccountData {
  jurisdictionID: string;
  type: string;
  ownershipType: string;
  wallet: {
    walletId?: string;
    walletAddress: string;
  };
}

interface ZynkExternalAccountResponse {
  success: boolean;
  data: {
    message: string;
    accountId: string;
  };
}

interface ZynkGetExternalAccountResponse {
  success: boolean;
  data: {
    id: string;
    entityId: string;
    walletAddress: string;
    status: string;
  };
}

// ============================================
// Repository Class
// ============================================

class ExternalAccountsRepository {
  // ============================================
  // Local Database Operations
  // ============================================

  async findById(id: string, userId: string) {
    return prismaClient.externalAccount.findFirst({
      where: {
        id,
        userId,
        deleted_at: null,
      },
    });
  }

  async findByWalletAddress(walletAddress: string, userId: string) {
    return prismaClient.externalAccount.findFirst({
      where: {
        walletAddress,
        userId,
        deleted_at: null,
      },
    });
  }

  async findAllByUserId(userId: string) {
    return prismaClient.externalAccount.findMany({
      where: {
        userId,
        deleted_at: null,
      },
      orderBy: {
        created_at: "desc",
      },
    });
  }

  async findNonCustodialAccount(userId: string) {
    return prismaClient.externalAccount.findFirst({
      where: {
        userId,
        type: "non_custodial_wallet",
        deleted_at: null,
      },
    });
  }

  async create(data: CreateExternalAccountInput) {
    return prismaClient.externalAccount.create({
      data: {
        userId: data.userId,
        walletAddress: data.walletAddress,
        label: data.label,
        zynkExternalAccountId: data.zynkExternalAccountId,
        type: data.type || "withdrawal",
        walletId: data.walletId,
        status: "ACTIVE",
      },
    });
  }

  async updateStatus(id: string, status: ExternalAccountStatus) {
    return prismaClient.externalAccount.update({
      where: { id },
      data: { status },
    });
  }

  async updateZynkAccountId(id: string, zynkExternalAccountId: string) {
    return prismaClient.externalAccount.update({
      where: { id },
      data: { zynkExternalAccountId },
    });
  }

  async softDelete(id: string) {
    return prismaClient.externalAccount.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }

  // ============================================
  // Zynk API Operations
  // ============================================

  async createExternalAccountInZynk(
    entityId: string,
    walletAddress: string,
    options?: { type?: string; walletId?: string }
  ): Promise<ZynkExternalAccountResponse> {
    const jurisdictionId = process.env.SOLANA_JURISDICTION_ID;

    if (!jurisdictionId) {
      throw new AppError(500, "SOLANA_JURISDICTION_ID is not configured");
    }

    const payload: ZynkExternalAccountData = {
      jurisdictionID: jurisdictionId,
      type: options?.type || "withdrawal",
      ownershipType: "third_party",
      wallet: {
        ...(options?.walletId && { walletId: options.walletId }),
        walletAddress: walletAddress,
      },
    };

    try {
      const response = await zynkClient.post<ZynkExternalAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId
        )}/add/external_account`,
        payload
      );
      return response.data;
    } catch (error) {
      handleZynkError(error, "Failed to create external account in Zynk");
    }
  }

  async getExternalAccountFromZynk(
    entityId: string,
    accountId: string
  ): Promise<ZynkGetExternalAccountResponse> {
    try {
      const response = await zynkClient.get<ZynkGetExternalAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId
        )}/external_account/${encodeURIComponent(accountId)}`
      );
      return response.data;
    } catch (error) {
      handleZynkError(error, "Failed to get external account from Zynk");
    }
  }

  async deleteExternalAccountFromZynk(
    entityId: string,
    accountId: string
  ): Promise<void> {
    try {
      await zynkClient.post(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId
        )}/delete/external_account/${encodeURIComponent(accountId)}`
      );
    } catch (error) {
      handleZynkError(error, "Failed to delete external account from Zynk");
    }
  }
}

export default new ExternalAccountsRepository();
export type {
  CreateExternalAccountInput,
  ZynkExternalAccountData,
  ZynkExternalAccountResponse,
  ZynkGetExternalAccountResponse,
};
