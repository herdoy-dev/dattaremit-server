import { AxiosError } from "axios";
import AppError from "./AppError";

interface ZynkErrorBody {
  success?: boolean;
  error?: {
    code: number;
    message: string;
    details?: string;
  };
  // Flat error format used by some Zynk/Cybrid endpoints
  status?: number;
  error_message?: string;
  message_code?: string;
}

export function handleZynkError(error: unknown, defaultMessage: string): never {
  if (error instanceof AppError) {
    throw error;
  }

  if (error instanceof AxiosError && error.response) {
    const zynkError = error.response.data as ZynkErrorBody;

    const SAFE_STATUS_CODES = [400, 401, 403, 404, 409, 422, 429];

    if (zynkError?.error) {
      const safeStatus = SAFE_STATUS_CODES.includes(zynkError.error.code)
        ? zynkError.error.code : 502;
      throw new AppError(safeStatus, "An error occurred processing your request");
    }

    // Handle flat error format: { status, error_message, message_code }
    if (zynkError?.error_message) {
      const safeStatus = SAFE_STATUS_CODES.includes(zynkError.status ?? 0)
        ? zynkError.status! : 502;
      throw new AppError(safeStatus, "An error occurred processing your request");
    }

    throw new AppError(error.response.status, defaultMessage);
  }

  // Handle network/timeout errors specifically
  if (error instanceof AxiosError) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw new AppError(504, "Zynk API request timed out. Please try again.");
    }
    if (error.code === "ECONNREFUSED") {
      throw new AppError(503, "Unable to reach Zynk API. Please try again later.");
    }
    if (error.code === "ENOTFOUND") {
      throw new AppError(503, "Zynk API is unreachable. Please try again later.");
    }
    if (error.code === "ECONNRESET") {
      throw new AppError(503, "Connection to Zynk API was reset. Please try again.");
    }
  }

  throw new AppError(500, "Failed to connect to Zynk API");
}
