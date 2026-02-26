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

/** @deprecated Use generateUserReferCode() instead */
export function generateReferCode(): string {
  return generateUserReferCode();
}
