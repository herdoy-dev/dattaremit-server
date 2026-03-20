import * as Sentry from "@sentry/node";
import Transport from "winston-transport";
import type { SeverityLevel } from "@sentry/node";

const LEVEL_MAP: Record<string, SeverityLevel> = {
  error: "error",
  warn: "warning",
  info: "info",
  debug: "debug",
};

export default class SentryBreadcrumbTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  log(info: Record<string, unknown>, callback: () => void) {
    const { level, message, timestamp, service, ...rest } = info;

    Sentry.addBreadcrumb({
      category: "winston",
      message: String(message),
      level: LEVEL_MAP[level as string] || "info",
      data: Object.keys(rest).length > 0 ? rest : undefined,
      timestamp: (() => {
        if (!timestamp) return undefined;
        const ts = new Date(timestamp as string).getTime() / 1000;
        return Number.isNaN(ts) ? undefined : ts;
      })(),
    });

    callback();
  }
}
