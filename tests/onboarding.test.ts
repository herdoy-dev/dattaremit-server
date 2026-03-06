import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockAuthAsUser, AUTH_TOKEN } from "./helpers/auth";
import { mockUser, mockAddress, validCreateAddressBody } from "./helpers/mock-data";

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

jest.mock("../services/address.service", () => ({
  __esModule: true,
  default: {
    getAllByUserId: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

jest.mock("../repositories/user.repository", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByClerkUserId: jest.fn(),
    findByZynkEntityId: jest.fn(),
    update: jest.fn(),
  },
}));

const userService = require("../services/user.service").default;
const addressService = require("../services/address.service").default;
const zynkService = require("../services/zynk.service").default;
const userRepository = require("../repositories/user.repository").default;

describe("Onboarding Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthAsUser();
  });

  describe("POST /api/onboarding/address", () => {
    it("should submit address and create entity", async () => {
      // dbUser middleware
      userService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      addressService.create.mockResolvedValueOnce(mockAddress);
      zynkService.createEntity.mockResolvedValueOnce(undefined);
      userRepository.findById.mockResolvedValueOnce({
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
      userService.getByClerkUserId.mockResolvedValueOnce(userWithEntity);
      addressService.create.mockResolvedValueOnce(mockAddress);
      userRepository.findById.mockResolvedValueOnce(userWithEntity);

      const res = await request(app)
        .post("/api/onboarding/address")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreateAddressBody);

      expect(res.status).toBe(201);
      expect(zynkService.createEntity).not.toHaveBeenCalled();
    });

    it("should return 400 with invalid address data", async () => {
      userService.getByClerkUserId.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post("/api/onboarding/address")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ type: "INVALID" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 when user not found in DB", async () => {
      userService.getByClerkUserId.mockResolvedValueOnce(null);

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
      userService.getByClerkUserId.mockResolvedValueOnce(userWithEntity);
      userRepository.findById.mockResolvedValueOnce(userWithEntity);
      zynkService.startKyc.mockResolvedValueOnce({
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
      userService.getByClerkUserId.mockResolvedValueOnce(userNoAddress);

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
      userService.getByClerkUserId.mockResolvedValueOnce(userWithAddress);
      zynkService.createEntity.mockResolvedValueOnce(undefined);
      userRepository.findById.mockResolvedValueOnce({
        ...userWithAddress,
        zynkEntityId: "new_entity_123",
      });
      zynkService.startKyc.mockResolvedValueOnce({
        kycLink: "https://kyc.zynk.com/verify/456",
        message: "KYC link sent successfully",
      });

      const res = await request(app)
        .post("/api/onboarding/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(zynkService.createEntity).toHaveBeenCalled();
    });
  });
});
