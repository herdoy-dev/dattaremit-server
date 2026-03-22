import crypto from "crypto";

// Unambiguous charset (no 0/O, 1/I/L)
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 4;
const PREFIX = "DATTA";

/** Generate a referral code for regular users: DATTA-{4 random chars} */
export function generateUserReferCode(): string {
  const bytes = crypto.randomBytes(USER_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < USER_CODE_LENGTH; i++) {
    code += CHARSET[bytes[i]! % CHARSET.length];
  }
  return `${PREFIX}-${code}`;
}

/** Generate a referral code for promoters/influencers: DATTA-{FIRSTNAME}{LASTNAMEINITIAL} */
export function generatePromoterReferCode(
  firstName: string,
  lastName: string,
): string {
  const cleanFirst = firstName.toUpperCase();
  const lastInitial = lastName.charAt(0).toUpperCase();
  return `${PREFIX}-${cleanFirst}${lastInitial}`;
}

/**
 * Generate a unique user refer code with retry logic.
 * Tries up to `maxAttempts` times to find an unused code.
 */
export async function generateUniqueUserReferCode(
  lookup: { findUnique: (args: { where: { referCode: string } }) => Promise<unknown> },
  maxAttempts = 3,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateUserReferCode();
    const existing = await lookup.findUnique({ where: { referCode: candidate } });
    if (!existing) return candidate;
  }
  return null;
}

/**
 * Generate a unique promoter refer code with suffix retry logic.
 * Tries base code first, then appends incrementing suffix.
 */
export async function generateUniquePromoterReferCode(
  lookup: { findUnique: (args: { where: { referCode: string } }) => Promise<unknown> },
  firstName: string,
  lastName: string,
  maxAttempts = 100,
): Promise<string> {
  const baseCode = generatePromoterReferCode(firstName, lastName);
  let referCode = baseCode;

  for (let suffix = 1; suffix <= maxAttempts; suffix++) {
    const existing = await lookup.findUnique({ where: { referCode } });
    if (!existing) return referCode;
    referCode = `${baseCode}${suffix + 1}`;
  }

  throw new Error("Failed to generate unique promoter refer code");
}

/** @deprecated Use generateUserReferCode() instead */
export function generateReferCode(): string {
  return generateUserReferCode();
}
