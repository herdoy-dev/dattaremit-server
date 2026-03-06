import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockAuthAsUser, AUTH_TOKEN } from "./helpers/auth";
import { mockUser, mockActiveUser } from "./helpers/mock-data";

const app = createTestApp();

jest.mock("../services/user.service", () => ({
  __esModule: true,
  default: {
    getByClerkUserId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    validateReferCode: jest.fn(),
    requestReferCode: jest.fn(),
    getReferralTrackerStats: jest.fn(),
  },
}));

jest.mock("../services/zynk.service", () => ({
  __esModule: true,
  default: {
    createEntity: jest.fn(),
    startKyc: jest.fn(),
    getKycStatus: jest.fn(),
    generatePlaidLinkToken: jest.fn(),
    addExternalAccount: jest.fn(),
    addDepositAccount: jest.fn(),
  },
}));

const userService = require("../services/user.service").default;
const zynkService = require("../services/zynk.service").default;
const prismaClient = require("../lib/prisma-client").default;

describe("Zynk Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthAsUser();
  });

  describe("POST /api/zynk/entities", () => {
    it("should return 400 without idempotency key", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/entities")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with short idempotency key", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/entities")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "short");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should create entity with valid idempotency key", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockUser);
      prismaClient.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      prismaClient.idempotencyKey.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaClient.idempotencyKey.create.mockResolvedValueOnce({
        id: "idem-1",
        key: "test-idempotency-key-12345",
        status: "PENDING",
      });
      prismaClient.idempotencyKey.update.mockResolvedValueOnce({});
      zynkService.createEntity.mockResolvedValueOnce({ zynkEntityId: "zynk_123" });

      const res = await request(app)
        .post("/api/zynk/entities")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).post("/api/zynk/entities");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/zynk/kyc", () => {
    it("should start KYC", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockUser);
      zynkService.startKyc.mockResolvedValueOnce({
        kycLink: "https://kyc.zynk.com/verify",
      });

      const res = await request(app)
        .post("/api/zynk/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("KYC started successfully");
    });
  });

  describe("GET /api/zynk/kyc/status", () => {
    it("should return KYC status", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockUser);
      zynkService.getKycStatus.mockResolvedValueOnce({ status: "pending" });

      const res = await request(app)
        .get("/api/zynk/kyc/status")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("pending");
    });
  });

  describe("POST /api/zynk/plaid-link-token", () => {
    it("should return 403 when account not active", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/plaid-link-token")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should generate plaid link token for active user", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      zynkService.generatePlaidLinkToken.mockResolvedValueOnce({
        linkToken: "link-sandbox-xxx",
      });

      const res = await request(app)
        .post("/api/zynk/plaid-link-token")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.linkToken).toBeDefined();
    });

    it("should reject invalid android_package_name", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockActiveUser);

      const res = await request(app)
        .post("/api/zynk/plaid-link-token")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ android_package_name: "com.malicious.app" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject invalid redirect_uri", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockActiveUser);

      const res = await request(app)
        .post("/api/zynk/plaid-link-token")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ redirect_uri: "https://evil.com/callback" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should accept valid redirect_uri", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      zynkService.generatePlaidLinkToken.mockResolvedValueOnce({
        linkToken: "link-sandbox-xxx",
      });

      const res = await request(app)
        .post("/api/zynk/plaid-link-token")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ redirect_uri: "https://dattaremit.com/callback" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("POST /api/zynk/external-account", () => {
    it("should return 403 when account not active", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/external-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          accountName: "My Bank",
          plaidPublicToken: "public-sandbox-xxx",
          plaidAccountId: "acc_123",
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Account is not approved yet.");
    });

    it("should return 400 with missing fields", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      prismaClient.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      prismaClient.idempotencyKey.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaClient.idempotencyKey.create.mockResolvedValueOnce({
        id: "idem-2",
        status: "PENDING",
      });
      prismaClient.idempotencyKey.update.mockResolvedValueOnce({});

      const res = await request(app)
        .post("/api/zynk/external-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/zynk/deposit-account", () => {
    it("should return 403 when account not active", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/deposit-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          bankName: "SBI",
          accountHolderName: "John Doe",
          accountNumber: "1234567890",
          routingNumber: "SBIN0001234",
          type: "SAVINGS",
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Account is not approved yet.");
    });

    it("should return 400 with invalid IFSC routing number", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      prismaClient.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      prismaClient.idempotencyKey.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaClient.idempotencyKey.create.mockResolvedValueOnce({
        id: "idem-3",
        status: "PENDING",
      });
      prismaClient.idempotencyKey.update.mockResolvedValueOnce({});

      const res = await request(app)
        .post("/api/zynk/deposit-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          bankName: "SBI",
          accountHolderName: "John Doe",
          accountNumber: "1234567890",
          routingNumber: "invalid",
          type: "SAVINGS",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid account type", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      prismaClient.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      prismaClient.idempotencyKey.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaClient.idempotencyKey.create.mockResolvedValueOnce({
        id: "idem-4",
        status: "PENDING",
      });
      prismaClient.idempotencyKey.update.mockResolvedValueOnce({});

      const res = await request(app)
        .post("/api/zynk/deposit-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          bankName: "SBI",
          accountHolderName: "John Doe",
          accountNumber: "1234567890",
          routingNumber: "SBIN0001234",
          type: "INVALID",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should add deposit account for active user", async () => {
      userService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      prismaClient.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      prismaClient.idempotencyKey.deleteMany.mockResolvedValueOnce({ count: 0 });
      prismaClient.idempotencyKey.create.mockResolvedValueOnce({
        id: "idem-5",
        status: "PENDING",
      });
      prismaClient.idempotencyKey.update.mockResolvedValueOnce({});
      zynkService.addDepositAccount.mockResolvedValueOnce({ success: true });

      const res = await request(app)
        .post("/api/zynk/deposit-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          bankName: "SBI",
          accountHolderName: "John Doe",
          accountNumber: "1234567890",
          routingNumber: "SBIN0001234",
          type: "SAVINGS",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
