import { mockUserService, mockAddressService, mockZynkService, mockUserRepository } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import { mockUser, mockAddress, validCreateAddressBody } from "./helpers/mock-data";
import { setupAuthOnly } from "./helpers/test-utils";

const app = createTestApp();

describe("Onboarding Endpoints", () => {
  beforeEach(() => {
    setupAuthOnly();
  });

  describe("POST /api/onboarding/address", () => {
    it("should submit address and create entity", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      mockAddressService.create.mockResolvedValueOnce(mockAddress);
      mockZynkService.createEntity.mockResolvedValueOnce(undefined);
      mockUserRepository.findById.mockResolvedValueOnce({
        ...mockUser,
        zynkEntityId: "zynk_entity_123",
      });

      const res = await request(app)
        .post("/api/onboarding/address")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreateAddressBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.address).toBeDefined();
      expect(res.body.data.entityCreated).toBe(true);
    });

    it("should skip entity creation if already exists", async () => {
      const userWithEntity = { ...mockUser, zynkEntityId: "existing_entity" };
      mockUserService.getByClerkUserId.mockResolvedValueOnce(userWithEntity);
      mockAddressService.create.mockResolvedValueOnce(mockAddress);
      mockUserRepository.findById.mockResolvedValueOnce(userWithEntity);

      const res = await request(app)
        .post("/api/onboarding/address")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreateAddressBody);

      expect(res.status).toBe(201);
      expect(mockZynkService.createEntity).not.toHaveBeenCalled();
    });

    it("should return 400 with invalid address data", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post("/api/onboarding/address")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ type: "INVALID" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when user not found in DB", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/onboarding/address")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreateAddressBody);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/onboarding/kyc", () => {
    it("should start KYC process", async () => {
      const userWithEntity = {
        ...mockUser,
        zynkEntityId: "zynk_entity_123",
        addresses: [mockAddress],
      };
      mockUserService.getByClerkUserId.mockResolvedValueOnce(userWithEntity);
      mockUserRepository.findById.mockResolvedValueOnce(userWithEntity);
      mockZynkService.startKyc.mockResolvedValueOnce({
        kycLink: "https://kyc.zynk.com/verify/123",
        message: "KYC link sent successfully",
      });

      const res = await request(app)
        .post("/api/onboarding/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 409 when user has no address", async () => {
      const userNoAddress = { ...mockUser, addresses: [] };
      mockUserService.getByClerkUserId.mockResolvedValueOnce(userNoAddress);

      const res = await request(app)
        .post("/api/onboarding/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should create entity if missing during KYC request", async () => {
      const userWithAddress = {
        ...mockUser,
        zynkEntityId: null,
        addresses: [mockAddress],
      };
      mockUserService.getByClerkUserId.mockResolvedValueOnce(userWithAddress);
      mockZynkService.createEntity.mockResolvedValueOnce(undefined);
      mockUserRepository.findById.mockResolvedValueOnce({
        ...userWithAddress,
        zynkEntityId: "new_entity_123",
      });
      mockZynkService.startKyc.mockResolvedValueOnce({
        kycLink: "https://kyc.zynk.com/verify/456",
        message: "KYC link sent successfully",
      });

      const res = await request(app)
        .post("/api/onboarding/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(mockZynkService.createEntity).toHaveBeenCalled();
    });
  });
});
