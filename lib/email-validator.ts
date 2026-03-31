import AppError from "./AppError";

/**
 * Ensures no other user exists with the given email.
 * Throws 409 if a user with this email already exists.
 */
export async function ensureEmailUnique(
  tx: { user: { findUnique: Function } },
  email: string,
): Promise<void> {
  const existing = await tx.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "User with this email already exists");
  }
}

/**
 * Ensures no other user (besides the given user) has this email.
 * Throws 409 if the email belongs to a different user.
 */
export async function ensureEmailUniqueForUpdate(
  tx: { user: { findUnique: Function } },
  email: string,
  currentEmail: string,
): Promise<void> {
  if (email !== currentEmail) {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, "User with this email already exists");
    }
  }
}
