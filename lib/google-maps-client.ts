import axios, { AxiosError, type AxiosInstance } from "axios";
import logger from "./logger";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNABORTED"]);
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

function addRetryInterceptor(client: AxiosInstance, serviceName: string) {
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

    logger.warn(`Retrying ${serviceName} API request`, {
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

// Address Validation API client
const googleValidationClient = axios.create({
  baseURL: "https://addressvalidation.googleapis.com",
  timeout: 10000,
});

googleValidationClient.interceptors.request.use((config) => {
  config.params = { ...config.params, key: process.env.GOOGLE_MAPS_API_KEY };
  return config;
});

addRetryInterceptor(googleValidationClient, "Google Address Validation");

// Places Autocomplete API client
const googlePlacesClient = axios.create({
  baseURL: "https://maps.googleapis.com/maps/api",
  timeout: 10000,
});

googlePlacesClient.interceptors.request.use((config) => {
  config.params = { ...config.params, key: process.env.GOOGLE_MAPS_API_KEY };
  return config;
});

addRetryInterceptor(googlePlacesClient, "Google Places");

export { googleValidationClient, googlePlacesClient };
