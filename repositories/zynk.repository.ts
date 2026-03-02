import { AxiosError } from "axios";
import zynkClient from "../lib/zynk-client";
import AppError from "../lib/AppError";
import { handleZynkError } from "../lib/zynk-error";
import {
  validateZynkResponse,
  zynkEntityResponseSchema,
  zynkKycResponseSchema,
  zynkKycStatusResponseSchema,
  zynkAddExternalAccountResponseSchema,
  zynkEnableExternalAccountResponseSchema,
  zynkPlaidLinkTokenResponseSchema,
} from "../schemas/zynk-response.schema";

interface ZynkEntityData {
  email: string;
  phoneNumberPrefix: string;
  phoneNumber: string;
}

interface ZynkEntityResponse {
  success: boolean;
  data: {
    message: string;
    entityId: string;
  };
}

interface ZynkKycResponse {
  success: boolean;
  data: {
    message: string;
    kycLink: string;
    tosLink?: string;
    kycStatus:
      | "not_started"
      | "initiated"
      | "reviewing"
      | "additional_info_required"
      | "rejected"
      | "approved";
  };
}

interface ZynkKycStatusResponse {
  success: boolean;
  message: string;
  data: {
    status: Array<{
      routingId: string;
      supportedRoutes: Array<{
        from: {
          jurisdictionId: string;
          jurisdictionName: string;
          jurisdictionType: string;
          currency: string;
        };
        to: {
          jurisdictionId: string;
          jurisdictionName: string;
          jurisdictionType: string;
          currency: string;
        };
      }>;
      kycStatus: string;
      routingEnabled: boolean;
      kycFees: {
        network: string;
        currency: string;
        tokenAddress: string;
        amount: number;
        toWalletAddress: string;
        paymentReceived: boolean;
      };
    }>;
  };
}

interface ZynkAddExternalAccountData {
  accountName: string;
  paymentRail: string;
  plaidPublicToken: string;
  plaidAccountId: string;
}

interface ZynkAddDepositAccountData {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  routingNumber: string;
  type: string; // "SAVINGS" or "CURRENT"
}

interface ZynkAddExternalAccountResponse {
  success: boolean;
  data: {
    message: string;
    accountId: string;
  };
}

interface ZynkEnableExternalAccountResponse {
  success: boolean;
  data: {
    message: string;
  };
}

interface ZynkPlaidLinkTokenResponse {
  plaid_token: string;
}

class ZynkRepository {
  async createEntity(data: ZynkEntityData): Promise<ZynkEntityResponse> {
    try {
      const response = await zynkClient.post<ZynkEntityResponse>(
        "/api/v1/transformer/entity/create",
        data,
      );
      return validateZynkResponse<ZynkEntityResponse>(
        response.data,
        zynkEntityResponseSchema,
        "Failed to create entity",
      );
    } catch (error) {
      handleZynkError(error, "API request failed");
    }
  }

  async startKyc(
    entityId: string,
    nationality: string,
  ): Promise<ZynkKycResponse> {
    const envKey =
      nationality === "US" ? "ZYNK_US_ROUTING_ID" : "ZYNK_INR_ROUTING_ID";
    const routingId = process.env[envKey];

    if (!routingId) {
      throw new AppError(500, `${envKey} is not configured`);
    }

    const maxRetries = 3;
    const retryDelayMs = 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await zynkClient.post<ZynkKycResponse>(
          `/api/v1/transformer/entity/kyc/${encodeURIComponent(
            entityId,
          )}/${routingId}`,
        );
        return validateZynkResponse<ZynkKycResponse>(
          response.data,
          zynkKycResponseSchema,
          "Failed to start KYC",
        );
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 404) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
          throw new AppError(404, "Entity not found in Zynk");
        }
        handleZynkError(error, "KYC request failed");
      }
    }

    throw new AppError(404, "Entity not found in Zynk");
  }

  async getKycStatus(entityId: string): Promise<ZynkKycStatusResponse> {
    try {
      const response = await zynkClient.get<ZynkKycStatusResponse>(
        `/api/v1/transformer/entity/kyc/${encodeURIComponent(entityId)}`,
      );
      return validateZynkResponse<ZynkKycStatusResponse>(
        response.data,
        zynkKycStatusResponseSchema,
        "Failed to get KYC status",
      );
    } catch (error) {
      handleZynkError(error, "Failed to get KYC status");
    }
  }

  async addExternalAccount(
    entityId: string,
    data: ZynkAddExternalAccountData,
  ): Promise<ZynkAddExternalAccountResponse> {
    const jurisdictionId = process.env.ZYNK_US_JURISDICTION_ID;

    if (!jurisdictionId) {
      throw new AppError(500, "ZYNK_US_JURISDICTION_ID is not configured");
    }

    try {
      const response = await zynkClient.post<ZynkAddExternalAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId,
        )}/add/external_account`,
        {
          jurisdictionID: jurisdictionId,
          type: "plaid",
          ownershipType: "first_party",
          account: data,
        },
      );
      return validateZynkResponse<ZynkAddExternalAccountResponse>(
        response.data,
        zynkAddExternalAccountResponseSchema,
        "Failed to add external account",
      );
    } catch (error) {
      handleZynkError(error, "Failed to add external account");
    }
  }

  async addDepositAccount(
    entityId: string,
    data: ZynkAddDepositAccountData,
  ): Promise<ZynkAddExternalAccountResponse> {
    const jurisdictionId = process.env.ZYNK_INR_JURISDICTION_ID;

    if (!jurisdictionId) {
      throw new AppError(500, "ZYNK_INR_JURISDICTION_ID is not configured");
    }

    const bankAccountTypeMap: Record<string, string> = {
      SAVINGS: "saving",
      CURRENT: "current",
    };

    try {
      const response = await zynkClient.post<ZynkAddExternalAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId,
        )}/add/external_account`,
        {
          jurisdictionID: jurisdictionId,
          type: "deposit",
          ownershipType: "first_party",
          bankAccountType: bankAccountTypeMap[data.type] || "saving",
          account: {
            bankName: data.bankName,
            accountHolderName: data.accountHolderName,
            accountNumber: data.accountNumber,
            routingNumber: data.routingNumber,
            type: data.type,
          },
        },
      );
      return validateZynkResponse<ZynkAddExternalAccountResponse>(
        response.data,
        zynkAddExternalAccountResponseSchema,
        "Failed to add deposit account",
      );
    } catch (error) {
      handleZynkError(error, "Failed to add deposit account");
    }
  }

  async enableExternalAccount(
    entityId: string,
    accountId: string,
  ): Promise<ZynkEnableExternalAccountResponse> {
    try {
      const response = await zynkClient.post<ZynkEnableExternalAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId,
        )}/enable/external_account/${encodeURIComponent(accountId)}`,
      );
      return validateZynkResponse<ZynkEnableExternalAccountResponse>(
        response.data,
        zynkEnableExternalAccountResponseSchema,
        "Failed to enable external account",
      );
    } catch (error) {
      handleZynkError(error, "Failed to enable external account");
    }
  }

  async generatePlaidLinkToken(
    entityId: string,
    options?: { androidPackageName?: string; redirectUri?: string },
  ): Promise<ZynkPlaidLinkTokenResponse> {
    const jurisdictionId = process.env.ZYNK_US_JURISDICTION_ID;

    if (!jurisdictionId) {
      throw new AppError(500, "ZYNK_US_JURISDICTION_ID is not configured");
    }

    try {
      const body: Record<string, unknown> = {
        jurisdictionId,
        createNewToken: true,
      };
      if (options?.androidPackageName) {
        body.android_package_name = options.androidPackageName;
      }
      if (options?.redirectUri) {
        body.redirect_uri = options.redirectUri;
      }

      const response = await zynkClient.post(
        `/api/v1/transformer/entity/${encodeURIComponent(
          entityId,
        )}/generate/plaid-link-token`,
        body,
      );
      // Zynk wraps responses in { success, data }, extract the inner data
      const zynkBody = response.data as { success: boolean; data: unknown };
      return validateZynkResponse<ZynkPlaidLinkTokenResponse>(
        zynkBody.data,
        zynkPlaidLinkTokenResponseSchema,
        "Failed to generate Plaid link token",
      );
    } catch (error) {
      handleZynkError(error, "Failed to generate Plaid link token");
    }
  }
}

export default new ZynkRepository();
export type {
  ZynkEntityData,
  ZynkEntityResponse,
  ZynkKycResponse,
  ZynkKycStatusResponse,
  ZynkAddExternalAccountData,
  ZynkAddDepositAccountData,
  ZynkAddExternalAccountResponse,
  ZynkEnableExternalAccountResponse,
  ZynkPlaidLinkTokenResponse,
};
