import winston from "winston";
import path from "node:path";
import fs from "node:fs";

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const PII_PATTERNS: [RegExp, string][] = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]"],
  [/\b\d{10,15}\b/g, "[PHONE_REDACTED]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]"],
  [/\b\d{9}\b/g, "[SSN_REDACTED]"],
  [/\b\d{13,19}\b/g, "[CARD_REDACTED]"],
];

const SENSITIVE_KEYS = new Set([
  "firstName",
  "lastName",
  "dateOfBirth",
  "addressLine1",
  "addressLine2",
  "accountNumber",
  "routingNumber",
  "plaidPublicToken",
  "plaidAccountId",
  "phoneNumber",
  "phoneNumberPrefix",
  "email",
  "nationality",
  "ipAddress",
]);

function maskPii(value: unknown): unknown {
  if (typeof value === "string") {
    let masked = value;
    for (const [pattern, replacement] of PII_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }
  if (Array.isArray(value)) return value.map(maskPii);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k) && v != null) {
        result[k] = "[PII_REDACTED]";
      } else {
        result[k] = maskPii(v);
      }
    }
    return result;
  }
  return value;
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
