import crypto from "crypto";

// Unambiguous charset (no 0/O, 1/I/L)
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const PREFIX = "DATTA";

export function generateReferCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[bytes[i]! % CHARSET.length];
  }
  return `${PREFIX}-${code}`;
}
