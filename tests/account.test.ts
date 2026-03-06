import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockAuthAsUser, mockAuthFailure, AUTH_TOKEN } from "./helpers/auth";
import { mockUser, mockAddress } from "./helpers/mock-data";

const app = createTestApp();

jest.mock("../repositories/user.repository", () => ({
  __esModule: true,
  default: {
    findByClerkUserId: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock("../repositories/address.repository", () => ({
  __esModule: true,
  default: {
    findAllByUserId: jest.fn(),
  },
}));

const userRepository = require("../repositories/user.repository").default;
const addressRepository = require("../repositories/address.repository").default;

describe("GET /api/account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 without auth token", async () => {
    const res = await request(app).get("/api/account");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return 401 with invalid token", async () => {
    mockAuthFailure();

    const res = await request(app)
      .get("/api/account")
      .set("x-auth-token", "invalid-token");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return account data for authenticated user", async () => {
    mockAuthAsUser();
    userRepository.findByClerkUserId.mockResolvedValueOnce(mockUser);
    addressRepository.findAllByUserId.mockResolvedValueOnce([mockAddress]);

    const res = await request(app)
      .get("/api/account")
      .set("x-auth-token", AUTH_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Account retrieved successfully");
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.addresses).toHaveLength(1);
    expect(res.body.data.accountStatus).toBe("INITIAL");
  });

  it("should return null user when user doesn't exist yet", async () => {
    mockAuthAsUser();
    userRepository.findByClerkUserId.mockResolvedValueOnce(null);
    addressRepository.findAllByUserId.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/account")
      .set("x-auth-token", AUTH_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeNull();
    expect(res.body.data.addresses).toHaveLength(0);
    expect(res.body.data.accountStatus).toBe("INITIAL");
  });
});
