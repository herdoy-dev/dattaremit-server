import axios, { AxiosError, type AxiosInstance } from "axios";
import AppError from "./AppError";
import logger from "./logger";

export interface ZynkErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    details: string;
  };
}

export function handleZynkError(
  error: unknown,
  fallbackMessage: string
): never {
  if (error instanceof AxiosError && error.response) {
    const zynkError = error.response.data as ZynkErrorResponse;

    if (zynkError?.error) {
      const errorMessage = zynkError.error.details || zynkError.error.message;
      throw new AppError(zynkError.error.code, errorMessage);
    }

    throw new AppError(error.response.status, fallbackMessage);
  }

  // Handle timeout errors specifically
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
  }

  throw new AppError(500, "Failed to connect to Zynk API");
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNABORTED"]);
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

// Add retry interceptor
function addRetryInterceptor(client: AxiosInstance) {
  client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config;
    if (!config) throw error;

    // @ts-expect-error - adding custom property
    config.__retryCount = config.__retryCount || 0;

    const shouldRetry =
      // @ts-expect-error - custom property
      config.__retryCount < MAX_RETRIES &&
      (RETRYABLE_CODES.has(error.code || "") ||
        RETRYABLE_STATUS_CODES.has(error.response?.status ?? 0));

    if (!shouldRetry) {
      throw error;
    }

    // @ts-expect-error - custom property
    config.__retryCount += 1;

    logger.warn("Retrying Zynk API request", {
      url: config.url,
      // @ts-expect-error - custom property
      attempt: config.__retryCount,
      maxRetries: MAX_RETRIES,
      errorCode: error.code,
      status: error.response?.status,
    });

    // Exponential backoff
    // @ts-expect-error - custom property
    const delay = RETRY_DELAY_MS * Math.pow(2, config.__retryCount - 1);
    await new Promise((resolve) => setTimeout(resolve, delay));

    return client.request(config);
  });
}

const zynkClient = axios.create({
  baseURL: process.env.ZYNK_API_BASE_URL,
  withCredentials: true,
  timeout: 60000, // Increased to 60 seconds for payment operations
});

zynkClient.interceptors.request.use(async (config) => {
  config.headers["x-api-token"] = process.env.ZYNK_API_TOKEN;
  return config;
});

// Add retry logic
addRetryInterceptor(zynkClient);

const ENTITY_ID_PATTERN = /^[\w-]+$/;

export const preparePasskeyRegistration = async (
  entityId: string,
  passkeyData: object
) => {
  if (!ENTITY_ID_PATTERN.test(entityId)) {
    throw new Error("Invalid entity ID format");
  }
  return zynkClient.post(
    `/api/v1/wallets/${entityId}/prepare-passkey-registration`,
    passkeyData
  );
};

export const submitPasskeyRegistration = async (
  payloadId: string,
  signature: string
) => {
  return zynkClient.post("/api/v1/wallets/submit-passkey-registration", {
    payloadId,
    signature,
  });
};

export default zynkClient;
