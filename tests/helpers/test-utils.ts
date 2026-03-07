import { mockAuthAsUser, mockAuthAsAdmin } from "./auth";
import { mockUserService } from "./service-mocks";
import { mockUser, mockAdminUser } from "./mock-data";

/**
 * Standard beforeEach for user-authenticated routes:
 * clearAllMocks + mock verifyToken + mock getByClerkUserId
 */
export function setupUserAuth(user = mockUser) {
  jest.clearAllMocks();
  mockAuthAsUser();
  mockUserService.getByClerkUserId.mockResolvedValue(user);
}

/**
 * Standard beforeEach for admin-authenticated routes:
 * clearAllMocks + mock verifyToken as admin + mock getByClerkUserId
 */
export function setupAdminAuth(admin = mockAdminUser) {
  jest.clearAllMocks();
  mockAuthAsAdmin();
  mockUserService.getByClerkUserId.mockResolvedValue(admin);
}

/**
 * Minimal beforeEach: just clearAllMocks + mock verifyToken.
 * For tests that don't need user lookup (webhooks, exchange-rate, etc.)
 */
export function setupAuthOnly() {
  jest.clearAllMocks();
  mockAuthAsUser();
}

/**
 * Mock the 4-line idempotency key flow used by zynk endpoints.
 */
export function mockIdempotencyKeyFlow(prismaClient: any, id = "idem-1") {
  prismaClient.idempotencyKey.findUnique.mockResolvedValueOnce(null);
  prismaClient.idempotencyKey.deleteMany.mockResolvedValueOnce({ count: 0 });
  prismaClient.idempotencyKey.create.mockResolvedValueOnce({ id, status: "PENDING" });
  prismaClient.idempotencyKey.update.mockResolvedValueOnce({});
}
