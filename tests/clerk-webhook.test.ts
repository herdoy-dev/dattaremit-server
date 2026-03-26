import { mockUserRepository } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockUser } from "./helpers/mock-data";

const app = createTestApp();

const notificationLogger = require("../lib/notification-logger").default;
const { Webhook } = require("svix");

// Helper to get the mock verify function from the Webhook constructor
function getMockVerify() {
  const mockInstance = Webhook.mock.results[Webhook.mock.results.length - 1]?.value;
  return mockInstance?.verify;
}

describe("POST /api/clerk-webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test_secret";
  });

  afterEach(() => {
    delete process.env.CLERK_WEBHOOK_SECRET;
  });

  it("should return 200 when CLERK_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;

    const res = await request(app)
      .post("/api/clerk-webhook")
      .set("svix-id", "msg_123")
      .set("svix-timestamp", "1234567890")
      .set("svix-signature", "v1,signature")
      .send({ type: "user.updated", data: {} });

    expect(res.status).toBe(200);
    expect(notificationLogger.notify).not.toHaveBeenCalled();
  });

  it("should return 401 when signature headers are missing", async () => {
    const res = await request(app)
      .post("/api/clerk-webhook")
      .send({ type: "user.updated", data: {} });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return 401 when signature verification fails", async () => {
    // Make verify throw to simulate invalid signature
    Webhook.mockImplementationOnce(() => ({
      verify: jest.fn().mockImplementation(() => {
        throw new Error("Invalid signature");
      }),
    }));

    const res = await request(app)
      .post("/api/clerk-webhook")
      .set("svix-id", "msg_123")
      .set("svix-timestamp", "1234567890")
      .set("svix-signature", "v1,invalid")
      .send({ type: "user.updated", data: {} });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid webhook signature");
  });

  it("should ignore non-user.updated events", async () => {
    Webhook.mockImplementationOnce(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.created",
        data: { id: "user_123" },
      }),
    }));

    const res = await request(app)
      .post("/api/clerk-webhook")
      .set("svix-id", "msg_123")
      .set("svix-timestamp", "1234567890")
      .set("svix-signature", "v1,valid")
      .send({ type: "user.created", data: {} });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Event ignored");
    expect(notificationLogger.notify).not.toHaveBeenCalled();
  });

  it("should ignore user.updated events without password change", async () => {
    Webhook.mockImplementationOnce(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.updated",
        data: { id: "user_123", updated_fields: ["first_name", "last_name"] },
      }),
    }));

    const res = await request(app)
      .post("/api/clerk-webhook")
      .set("svix-id", "msg_123")
      .set("svix-timestamp", "1234567890")
      .set("svix-signature", "v1,valid")
      .send({ type: "user.updated", data: {} });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Event ignored");
    expect(notificationLogger.notify).not.toHaveBeenCalled();
  });

  it("should send password change notification when password is in updated_fields", async () => {
    Webhook.mockImplementationOnce(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.updated",
        data: {
          id: "user_test123",
          updated_fields: ["password"],
        },
      }),
    }));

    mockUserRepository.findByClerkUserId.mockResolvedValueOnce(mockUser);

    const res = await request(app)
      .post("/api/clerk-webhook")
      .set("svix-id", "msg_123")
      .set("svix-timestamp", "1234567890")
      .set("svix-signature", "v1,valid")
      .send({ type: "user.updated", data: {} });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password change notification sent");
    expect(notificationLogger.notify).toHaveBeenCalledWith({
      userId: mockUser.id,
      type: "PASSWORD_CHANGED",
      title: "Password Changed",
      body: "Your password was recently changed. If this wasn't you, please contact support immediately.",
    });
  });

  it("should return 200 when user is not found in database", async () => {
    Webhook.mockImplementationOnce(() => ({
      verify: jest.fn().mockReturnValue({
        type: "user.updated",
        data: {
          id: "user_unknown",
          updated_fields: ["password"],
        },
      }),
    }));

    mockUserRepository.findByClerkUserId.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/clerk-webhook")
      .set("svix-id", "msg_123")
      .set("svix-timestamp", "1234567890")
      .set("svix-signature", "v1,valid")
      .send({ type: "user.updated", data: {} });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User not found");
    expect(notificationLogger.notify).not.toHaveBeenCalled();
  });
});
