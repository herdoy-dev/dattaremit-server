import { mockUserService, mockZynkService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import { mockUser, mockActiveUser } from "./helpers/mock-data";
import { setupAuthOnly, mockIdempotencyKeyFlow } from "./helpers/test-utils";

const app = createTestApp();

const prismaClient = require("../lib/prisma-client").default;

describe("Zynk Endpoints", () => {
  beforeEach(() => {
    setupAuthOnly();
  });

  describe("POST /api/zynk/entities", () => {
    it("should return 400 without idempotency key", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/entities")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with short idempotency key", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/entities")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "short");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should create entity with valid idempotency key", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockUser);
      mockIdempotencyKeyFlow(prismaClient);
      mockZynkService.createEntity.mockResolvedValueOnce({ zynkEntityId: "zynk_123" });

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
      const userWithAddress = { ...mockUser, addresses: [{ id: "addr-1" }] };
      mockUserService.getByClerkUserId.mockResolvedValue(userWithAddress);
      mockZynkService.startKyc.mockResolvedValueOnce({
        kycLink: "https://kyc.zynk.com/verify",
      });

      const res = await request(app)
        .post("/api/zynk/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("KYC started successfully");
    });

    it("should return 409 when user has no addresses", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Please complete the address step first.");
    });
  });

  describe("GET /api/zynk/kyc/status", () => {
    it("should return KYC status", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockUser);
      mockZynkService.getKycStatus.mockResolvedValueOnce({ status: "pending" });

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
      mockUserService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/plaid-link-token")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should generate plaid link token for active user", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      mockZynkService.generatePlaidLinkToken.mockResolvedValueOnce({
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
      mockUserService.getByClerkUserId.mockResolvedValue(mockActiveUser);

      const res = await request(app)
        .post("/api/zynk/plaid-link-token")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ android_package_name: "com.malicious.app" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject invalid redirect_uri", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockActiveUser);

      const res = await request(app)
        .post("/api/zynk/plaid-link-token")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ redirect_uri: "https://evil.com/callback" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should accept valid redirect_uri", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      mockZynkService.generatePlaidLinkToken.mockResolvedValueOnce({
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
      mockUserService.getByClerkUserId.mockResolvedValue(mockUser);

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
      mockUserService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      mockIdempotencyKeyFlow(prismaClient, "idem-2");

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
      mockUserService.getByClerkUserId.mockResolvedValue(mockUser);

      const res = await request(app)
        .post("/api/zynk/deposit-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          bankName: "SBI",
          accountName: "John Doe",
          accountNumber: "1234567890",
          ifsc: "SBIN0001234",
          branchName: "Main Branch",
          bankAccountType: "SAVINGS",
          phoneNumber: "+919838387750",
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Account is not approved yet.");
    });

    it("should return 400 with invalid IFSC routing number", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      mockIdempotencyKeyFlow(prismaClient, "idem-3");

      const res = await request(app)
        .post("/api/zynk/deposit-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          bankName: "SBI",
          accountName: "John Doe",
          accountNumber: "1234567890",
          ifsc: "invalid",
          branchName: "Main Branch",
          bankAccountType: "SAVINGS",
          phoneNumber: "+919838387750",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid account type", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      mockIdempotencyKeyFlow(prismaClient, "idem-4");

      const res = await request(app)
        .post("/api/zynk/deposit-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          bankName: "SBI",
          accountName: "John Doe",
          accountNumber: "1234567890",
          ifsc: "SBIN0001234",
          branchName: "Main Branch",
          bankAccountType: "INVALID",
          phoneNumber: "+919838387750",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should add deposit account for active user", async () => {
      mockUserService.getByClerkUserId.mockResolvedValue(mockActiveUser);
      mockIdempotencyKeyFlow(prismaClient, "idem-5");
      mockZynkService.addDepositAccount.mockResolvedValueOnce({ success: true });

      const res = await request(app)
        .post("/api/zynk/deposit-account")
        .set("x-auth-token", AUTH_TOKEN)
        .set("idempotency-key", "test-idempotency-key-12345")
        .send({
          bankName: "SBI",
          accountName: "John Doe",
          accountNumber: "1234567890",
          ifsc: "SBIN0001234",
          branchName: "Main Branch",
          bankAccountType: "SAVINGS",
          phoneNumber: "+919838387750",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
