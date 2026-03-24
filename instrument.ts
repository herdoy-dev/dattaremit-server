import * as Sentry from "@sentry/node";
import { readFileSync } from "fs";
import { resolve } from "path";
import { maskPii } from "./lib/pii";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  const isProduction = process.env.NODE_ENV === "production";

  // Auto-detect release from package.json when SENTRY_RELEASE is not set
  let release: string | undefined = process.env.SENTRY_RELEASE;
  if (!release) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));
      release = `dattaremit-server@${pkg.version}`;
    } catch { /* fallback: no release */ }
  }

  Sentry.init({
    dsn,
    release,
    environment: process.env.NODE_ENV || "development",
    sendDefaultPii: false,

    integrations: [
      Sentry.prismaIntegration(),
    ],

    tracesSampler(samplingContext) {
      // Respect parent sampling for distributed tracing continuity
      if (samplingContext.parentSampled !== undefined) {
        return samplingContext.parentSampled ? 1.0 : 0;
      }

      const name = samplingContext.name || "";

      // Never trace health checks
      if (name.includes("/health")) return 0;

      // Always trace webhooks (financial operations)
      if (name.includes("/webhook")) return 1.0;

      // Higher rate for admin operations
      if (name.includes("/admin")) return isProduction ? 0.5 : 1.0;

      // Default
      return isProduction ? 0.3 : 1.0;
    },

    // Only propagate trace headers to our own API domain — not to
    // Zynk, Resend, exchange-rate API, Clerk, or any other third party.
    tracePropagationTargets: [
      /^https:\/\/api\.dattaremit\.com/,
      /^http:\/\/localhost/,
    ],

    _experiments: { enableLogs: true },

    beforeSend(event, hint) {
      // Enrich AppError events with correct severity level and status tag
      const error = hint?.originalException;
      if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status: number }).status;
        event.level = status >= 500 ? "error" : "warning";
        event.tags = { ...event.tags, "error.status": String(status) };
      }

      if (event.request?.data) {
        event.request.data = maskPii(event.request.data) as typeof event.request.data;
      }
      if (event.request?.headers) {
        event.request.headers = maskPii(event.request.headers) as typeof event.request.headers;
      }
      if (event.request?.query_string) {
        event.request.query_string = maskPii(event.request.query_string) as typeof event.request.query_string;
      }
      if (event.extra) {
        event.extra = maskPii(event.extra) as typeof event.extra;
      }
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = maskPii(ex.value) as string;
        }
      }
      return event;
    },

    beforeSendTransaction(event) {
      if (event.extra) {
        event.extra = maskPii(event.extra) as typeof event.extra;
      }
      for (const span of event.spans || []) {
        if (span.data) {
          span.data = maskPii(span.data) as typeof span.data;
        }
      }
      return event;
    },
  });
}
