import { AxiosError } from "axios";
import zynkClient from "../lib/zynk-client";
import AppError from "../lib/AppError";
import { handleZynkError } from "../lib/zynk-error";
import {
  validateZynkResponse,
  zynkEntityResponseSchema,
  zynkKycResponseSchema,
  zynkKycStatusResponseSchema,
  zynkCreateFundingAccountResponseSchema,
  zynkGetFundingAccountResponseSchema,
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

interface ZynkFundingAccountData {
  id: string;
  entityId: string;
  jurisdictionId: string;
  providerId: string;
  status: string;
  accountInfo: {
    currency: string;
    bank_name: string;
    bank_address: string;
    bank_routing_number: string;
    bank_account_number: string;
    bank_beneficiary_name: string;
    bank_beneficiary_address: string;
    payment_rail: string;
    payment_rails: string[];
  };
}

interface ZynkCreateFundingAccountResponse {
  success: boolean;
  data: {
    message: string;
    data: ZynkFundingAccountData;
  };
}

interface ZynkGetFundingAccountResponse {
  success: boolean;
  data: ZynkFundingAccountData;
}

interface ZynkPlaidLinkTokenResponse {
  plaid_token: string;
}

class ZynkRepository {
  async createEntity(data: ZynkEntityData): Promise<ZynkEntityResponse> {
    try {
      const response = await zynkClient.post<ZynkEntityResponse>(
        "/api/v1/transformer/entity/create",
        data
      );
      return validateZynkResponse<ZynkEntityResponse>(
        response.data,
        zynkEntityResponseSchema,
        "Failed to create entity"
      );
    } catch (error) {
      handleZynkError(error, "API request failed");
    }
  }

  async startKyc(entityId: string): Promise<ZynkKycResponse> {
    const routingId = process.env.ZYNK_ROUTING_ID;

    if (!routingId) {
      throw new AppError(500, "ZYNK_ROUTING_ID is not configured");
    }

    const maxRetries = 3;
    const retryDelayMs = 2000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await zynkClient.post<ZynkKycResponse>(
          `/api/v1/transformer/entity/kyc/${encodeURIComponent(
            entityId
          )}/${routingId}`
        );
        return validateZynkResponse<ZynkKycResponse>(
          response.data,
          zynkKycResponseSchema,
          "Failed to start KYC"
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
        `/api/v1/transformer/entity/kyc/${encodeURIComponent(entityId)}`
      );
      return validateZynkResponse<ZynkKycStatusResponse>(
        response.data,
        zynkKycStatusResponseSchema,
        "Failed to get KYC status"
      );
    } catch (error) {
      handleZynkError(error, "Failed to get KYC status");
    }
  }

  async createFundingAccount(
    entityId: string
  ): Promise<ZynkCreateFundingAccountResponse> {
    const jurisdictionId = process.env.ZYNK_JURISDICTION_ID;

    if (!jurisdictionId) {
      throw new AppError(500, "ZYNK_JURISDICTION_ID is not configured");
    }

    try {
      const response = await zynkClient.post<ZynkCreateFundingAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId
        )}/create/funding_account/${jurisdictionId}`
      );
      return validateZynkResponse<ZynkCreateFundingAccountResponse>(
        response.data,
        zynkCreateFundingAccountResponseSchema,
        "Failed to create funding account"
      );
    } catch (error) {
      handleZynkError(error, "Failed to create funding account");
    }
  }

  async getFundingAccount(
    entityId: string,
    accountId: string
  ): Promise<ZynkGetFundingAccountResponse> {
    try {
      const response = await zynkClient.get<ZynkGetFundingAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId
        )}/funding_account/${encodeURIComponent(accountId)}`
      );
      return validateZynkResponse<ZynkGetFundingAccountResponse>(
        response.data,
        zynkGetFundingAccountResponseSchema,
        "Failed to get funding account"
      );
    } catch (error) {
      handleZynkError(error, "Failed to get funding account");
    }
  }

  async activateFundingAccount(
    entityId: string,
    accountId: string
  ): Promise<ZynkCreateFundingAccountResponse> {
    try {
      const response = await zynkClient.post<ZynkCreateFundingAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId
        )}/activate/funding_account/${encodeURIComponent(accountId)}`
      );
      return validateZynkResponse<ZynkCreateFundingAccountResponse>(
        response.data,
        zynkCreateFundingAccountResponseSchema,
        "Failed to activate funding account"
      );
    } catch (error) {
      handleZynkError(error, "Failed to activate funding account");
    }
  }

  async deactivateFundingAccount(
    entityId: string,
    accountId: string
  ): Promise<ZynkCreateFundingAccountResponse> {
    try {
      const response = await zynkClient.post<ZynkCreateFundingAccountResponse>(
        `/api/v1/transformer/accounts/${encodeURIComponent(
          entityId
        )}/deactivate/funding_account/${encodeURIComponent(accountId)}`
      );
      return validateZynkResponse<ZynkCreateFundingAccountResponse>(
        response.data,
        zynkCreateFundingAccountResponseSchema,
        "Failed to deactivate funding account"
      );
    } catch (error) {
      handleZynkError(error, "Failed to deactivate funding account");
    }
  }

  async generatePlaidLinkToken(
    entityId: string,
    options?: { androidPackageName?: string; redirectUri?: string }
  ): Promise<ZynkPlaidLinkTokenResponse> {
    const jurisdictionId = process.env.ZYNK_JURISDICTION_ID;

    if (!jurisdictionId) {
      throw new AppError(500, "ZYNK_JURISDICTION_ID is not configured");
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
          entityId
        )}/generate/plaid-link-token`,
        body
      );
      // Zynk wraps responses in { success, data }, extract the inner data
      const zynkBody = response.data as { success: boolean; data: unknown };
      return validateZynkResponse<ZynkPlaidLinkTokenResponse>(
        zynkBody.data,
        zynkPlaidLinkTokenResponseSchema,
        "Failed to generate Plaid link token"
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
  ZynkFundingAccountData,
  ZynkCreateFundingAccountResponse,
  ZynkGetFundingAccountResponse,
  ZynkPlaidLinkTokenResponse,
};
