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

    if (zynkError?.error) {
      const errorMessage = zynkError.error.details || zynkError.error.message;
      throw new AppError(zynkError.error.code, errorMessage);
    }

    // Handle flat error format: { status, error_message, message_code }
    if (zynkError?.error_message) {
      throw new AppError(
        zynkError.status || error.response.status,
        zynkError.error_message
      );
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
