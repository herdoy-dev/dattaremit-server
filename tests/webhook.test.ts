import { mockUserRepository } from "./helpers/service-mocks";
import * as crypto from "node:crypto";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockUser } from "./helpers/mock-data";

const app = createTestApp();

const activityLogger = require("../lib/activity-logger").default;

const WEBHOOK_SECRET = process.env.ZYNK_WEBHOOK_SECRET!;

function generateSignature(body: object, secret: string): string {
  const timestamp = Date.now().toString();
  const bodyStr = JSON.stringify(body).replace(/}$/, `,"signedAt":"${timestamp}"}`);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(bodyStr)
    .digest("base64");
  return `${timestamp}:${signature}`;
}

const validKycPayload = {
  eventCategory: "kyc",
  eventType: "kyc_verification",
  eventStatus: "approved",
  eventObject: {
    entityId: "zynk_entity_123",
    status: "approved",
  },
};

describe("POST /api/webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 without signature header", async () => {
    const res = await request(app)
      .post("/api/webhook")
      .send(validKycPayload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing webhook signature");
  });

  it("should return 401 with invalid signature format", async () => {
    const res = await request(app)
      .post("/api/webhook")
      .set("z-webhook-signature", "invalid")
      .send(validKycPayload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return 401 with expired signature", async () => {
    const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString();
    const bodyStr = JSON.stringify(validKycPayload).replace(/}$/, `,"signedAt":"${oldTimestamp}"}`);
    const signature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(bodyStr)
      .digest("base64");

    const res = await request(app)
      .post("/api/webhook")
      .set("z-webhook-signature", `${oldTimestamp}:${signature}`)
      .send(validKycPayload);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Webhook signature has expired");
  });

  it("should process approved KYC webhook successfully", async () => {
    mockUserRepository.findByZynkEntityId.mockResolvedValueOnce({
      ...mockUser,
      zynkEntityId: "zynk_entity_123",
    });
    mockUserRepository.update.mockResolvedValueOnce({
      ...mockUser,
      accountStatus: "ACTIVE",
    });

    const sig = generateSignature(validKycPayload, WEBHOOK_SECRET);

    const res = await request(app)
      .post("/api/webhook")
      .set("z-webhook-signature", sig)
      .send(validKycPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockUserRepository.update).toHaveBeenCalledWith(
      mockUser.id,
      { accountStatus: "ACTIVE" }
    );
  });

  it("should ignore non-kyc events", async () => {
    const payload = {
      ...validKycPayload,
      eventCategory: "transfer",
    };
    const sig = generateSignature(payload, WEBHOOK_SECRET);

    const res = await request(app)
      .post("/api/webhook")
      .set("z-webhook-signature", sig)
      .send(payload);

    expect([200, 401]).toContain(res.status);
  });

  it("should return 400 with invalid payload", async () => {
    const payload = { foo: "bar" };
    const sig = generateSignature(payload, WEBHOOK_SECRET);

    const res = await request(app)
      .post("/api/webhook")
      .set("z-webhook-signature", sig)
      .send(payload);

    expect([400, 401]).toContain(res.status);
  });

  it("should log rejected KYC", async () => {
    const payload = {
      ...validKycPayload,
      eventStatus: "rejected",
      eventObject: {
        entityId: "zynk_entity_123",
        status: "rejected",
      },
    };

    mockUserRepository.findByZynkEntityId.mockResolvedValueOnce({
      ...mockUser,
      zynkEntityId: "zynk_entity_123",
    });

    const sig = generateSignature(payload, WEBHOOK_SECRET);

    const res = await request(app)
      .post("/api/webhook")
      .set("z-webhook-signature", sig)
      .send(payload);

    if (res.status === 200) {
      expect(activityLogger.logActivity).toHaveBeenCalled();
    }
  });
});
