import { AxiosError } from "axios";
import zynkClient from "../lib/zynk-client";
import AppError from "../lib/AppError";

// ============================================
// Input Types
// ============================================

interface SimulateTransferInput {
  transactionId: string;
  fromEntityId: string;
  fromAccountId: string;
  toEntityId: string;
  toAccountId: string;
  exactAmountIn?: number;
  exactAmountOut?: number;
  depositMemo?: string;
}

interface ExecuteTransferInput {
  executionId: string;
  payloadSignature: string;
  transferAcknowledgement: string;
  signatureType: string;
}

// ============================================
// Response Types
// ============================================

interface ZynkSimulateResponse {
  success: boolean;
  data: {
    executionId: string;
    quote: {
      inAmount: { amount: number; currency: string };
      outAmount: { amount: number; currency: string };
      exchangeRate: { rate: number; conversion: string };
      fees: {
        partnerFees: { amount: number; currency: string };
        zynkFees: { amount: number; currency: string };
        totalFees: { amount: number; currency: string };
      };
    };
    validUntil: string;
    message: string;
    payloadToSign: string;
  };
}

interface ZynkTransferResponse {
  success: boolean;
  data: {
    executionId: string;
    message: string;
  };
}

interface ZynkErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    details: string;
  };
}

// ============================================
// Repository Class
// ============================================

class TransferRepository {
  async simulateTransfer(
    data: SimulateTransferInput
  ): Promise<ZynkSimulateResponse> {
    const payload: Record<string, unknown> = {
      transactionId: data.transactionId,
      fromEntityId: data.fromEntityId,
      fromAccountId: data.fromAccountId,
      toEntityId: data.toEntityId,
      toAccountId: data.toAccountId,
    };

    if (data.exactAmountIn !== undefined) {
      payload.exactAmountIn = data.exactAmountIn;
    } else if (data.exactAmountOut !== undefined) {
      payload.exactAmountOut = data.exactAmountOut;
    }

    if (data.depositMemo) {
      payload.depositMemo = data.depositMemo;
    }

    try {
      const response = await zynkClient.post<ZynkSimulateResponse>(
        "/api/v1/transformer/transaction/simulate",
        payload
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        const zynkError = error.response.data as ZynkErrorResponse;

        if (zynkError?.error) {
          const errorMessage =
            zynkError.error.details || zynkError.error.message;
          throw new AppError(zynkError.error.code, errorMessage);
        }

        throw new AppError(
          error.response.status,
          "Failed to simulate transfer"
        );
      }

      throw new AppError(500, "Failed to connect to Zynk API");
    }
  }

  async executeTransfer(
    data: ExecuteTransferInput
  ): Promise<ZynkTransferResponse> {
    const payload = {
      executionId: data.executionId,
      payloadSignature: data.payloadSignature,
      transferAcknowledgement: data.transferAcknowledgement,
      signatureType: data.signatureType,
    };

    try {
      const response = await zynkClient.post<ZynkTransferResponse>(
        "/api/v1/transformer/transaction/transfer",
        payload
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        const zynkError = error.response.data as ZynkErrorResponse;

        if (zynkError?.error) {
          const errorMessage =
            zynkError.error.details || zynkError.error.message;
          throw new AppError(zynkError.error.code, errorMessage);
        }

        throw new AppError(error.response.status, "Failed to execute transfer");
      }

      throw new AppError(500, "Failed to connect to Zynk API");
    }
  }
}

export default new TransferRepository();
