import winston from "winston";
import path from "node:path";
import fs from "node:fs";
import { maskPii } from "./pii";
import SentryBreadcrumbTransport from "./sentry-breadcrumb-transport";

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const piiMaskFormat = winston.format((info) => {
  return maskPii(info) as winston.Logform.TransformableInfo;
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    piiMaskFormat(),
    winston.format.json()
  ),
  defaultMeta: { service: "user-service" },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "rejections.log"),
    }),
  ],
});

if (process.env.SENTRY_DSN) {
  logger.add(new SentryBreadcrumbTransport({ level: "info" }));
}

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        piiMaskFormat(),
        winston.format.simple()
      ),
    })
  );

  logger.exceptions.handle(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        piiMaskFormat(),
        winston.format.simple()
      ),
    })
  );

  logger.rejections.handle(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        piiMaskFormat(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;
