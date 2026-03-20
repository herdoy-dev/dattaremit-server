const PII_PATTERNS: [RegExp, string][] = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL_REDACTED]"],
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

export function maskPii(value: unknown): unknown {
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
