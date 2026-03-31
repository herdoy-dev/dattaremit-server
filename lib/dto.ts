/**
 * Data Transfer Object helpers to strip internal fields
 * before sending user data to non-admin clients.
 */

const INTERNAL_USER_FIELDS = [
  "zynkEntityId",
  "zynkExternalAccountId",
  "zynkDepositAccountId",
  "clerkUserId",
] as const;

/**
 * Strips internal/sensitive fields from a user object
 * so they are never exposed to non-admin API consumers.
 */
export function toPublicUser<T extends Record<string, unknown>>(
  user: T,
): Omit<T, (typeof INTERNAL_USER_FIELDS)[number]> {
  const copy = { ...user };
  for (const field of INTERNAL_USER_FIELDS) {
    delete (copy as Record<string, unknown>)[field];
  }
  return copy as Omit<T, (typeof INTERNAL_USER_FIELDS)[number]>;
}

/**
 * Maps an array of user objects through `toPublicUser`.
 */
export function toPublicUsers<T extends Record<string, unknown>>(
  users: T[],
): Omit<T, (typeof INTERNAL_USER_FIELDS)[number]>[] {
  return users.map(toPublicUser);
}
