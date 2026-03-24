import * as Sentry from "@sentry/node";
import Transport from "winston-transport";

const LEVEL_METHOD_MAP: Record<string, "error" | "warn" | "info" | "debug"> = {
  error: "error",
  warn: "warn",
  info: "info",
  debug: "debug",
};

export default class SentryLogTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  override log(info: Record<string, unknown>, callback: () => void) {
    const { level, message, timestamp, service, ...rest } = info;
    const method = LEVEL_METHOD_MAP[level as string] || "info";

    const attributes: Record<string, string | number | boolean> = {};

    // Include timestamp and service metadata
    if (typeof timestamp === "string") attributes["log.timestamp"] = timestamp;
    if (typeof service === "string") attributes["service.name"] = service;

    for (const [key, value] of Object.entries(rest)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        attributes[key] = value;
      } else if (value !== null && value !== undefined) {
        try {
          attributes[key] = JSON.stringify(value);
        } catch {
          attributes[key] = String(value);
        }
      }
    }

    // Pull request_id from Sentry scope for log-trace correlation
    const scopeData = Sentry.getCurrentScope()?.getScopeData?.();
    const requestId = scopeData?.tags?.request_id;
    if (requestId && typeof requestId === "string") {
      attributes["request_id"] = requestId;
    }

    Sentry.logger[method](String(message), attributes);
    callback();
  }
}
