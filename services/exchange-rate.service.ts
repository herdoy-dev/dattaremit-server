import * as Sentry from "@sentry/node";
import logger from "../lib/logger";

interface ExchangeRateCache {
  rate: number;
  updatedAt: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const MAX_STALENESS_MS = 4 * 60 * 60 * 1000; // 4 hours

let cache: ExchangeRateCache | null = null;

class ExchangeRateService {
  async getRate(): Promise<{ rate: number; updatedAt: string; stale: boolean }> {
    const now = Date.now();
    const cacheHit = !!(cache && now < cache.expiresAt);

    return Sentry.startSpan(
      { name: "exchangeRate.getRate", op: "http.client", attributes: { cache_hit: cacheHit, stale: false } },
      async (span) => {
        if (cacheHit) {
          return { rate: cache!.rate, updatedAt: cache!.updatedAt, stale: false };
        }

        try {
          const response = await fetch(
            "https://open.er-api.com/v6/latest/USD",
            { signal: AbortSignal.timeout(10_000) }
          );

          if (!response.ok) {
            throw new Error(`Exchange rate API returned ${response.status}`);
          }

          const data = (await response.json()) as { rates?: Record<string, number> };
          const rate = data.rates?.INR;

          if (typeof rate !== "number") {
            throw new Error("INR rate not found in response");
          }

          const updatedAt = new Date().toISOString();
          cache = { rate, updatedAt, expiresAt: now + CACHE_TTL_MS };

          return { rate, updatedAt, stale: false };
        } catch (error) {
          logger.error("Failed to fetch exchange rate", { error });

          // Return stale cache if available and not too old
          if (cache) {
            const cacheAge = now - (cache.expiresAt - CACHE_TTL_MS);
            if (cacheAge > MAX_STALENESS_MS) {
              throw new Error("Exchange rate data is too stale to serve");
            }
            span.setAttribute("stale", true);
            return { rate: cache.rate, updatedAt: cache.updatedAt, stale: true };
          }

          throw error;
        }
      },
    );
  }
}

export default new ExchangeRateService();
