import { AxiosError } from "axios";
import AppError from "./AppError";

interface GoogleMapsErrorBody {
  error?: {
    code: number;
    message: string;
    status: string;
  };
  status?: string;
  error_message?: string;
}

export function handleGoogleMapsError(
  error: unknown,
  defaultMessage: string
): never {
  if (error instanceof AppError) {
    throw error;
  }

  if (error instanceof AxiosError && error.response) {
    const body = error.response.data as GoogleMapsErrorBody;

    const SAFE_STATUS_CODES = [400, 403, 429];

    if (body?.error) {
      const safeStatus = SAFE_STATUS_CODES.includes(body.error.code)
        ? body.error.code
        : 502;
      throw new AppError(
        safeStatus,
        safeStatus === 429
          ? "Too many requests. Please try again later."
          : "An error occurred processing your request"
      );
    }

    if (body?.error_message) {
      throw new AppError(502, "An error occurred processing your request");
    }

    throw new AppError(error.response.status, defaultMessage);
  }

  if (error instanceof AxiosError) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw new AppError(
        504,
        "Google Maps API request timed out. Please try again."
      );
    }
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      throw new AppError(
        503,
        "Unable to reach Google Maps API. Please try again later."
      );
    }
    if (error.code === "ECONNRESET") {
      throw new AppError(
        503,
        "Connection to Google Maps API was reset. Please try again."
      );
    }
  }

  throw new AppError(500, "Failed to connect to Google Maps API");
}
