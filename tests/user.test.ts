import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockAuthAsUser, AUTH_TOKEN } from "./helpers/auth";
import { mockUser, validCreateUserBody } from "./helpers/mock-data";

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

const userService = require("../services/user.service").default;

describe("User Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthAsUser();
  });

  describe("POST /api/users", () => {
    it("should create a new user", async () => {
      userService.getByClerkUserId.mockResolvedValueOnce(null);
      userService.create.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreateUserBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User created successfully");
    });

    it("should update existing user instead of creating duplicate", async () => {
      userService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      userService.update.mockResolvedValueOnce({ ...mockUser, firstName: "Updated" });

      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreateUserBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Profile updated successfully");
    });

    it("should return 403 when clerkUserId doesn't match token", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validCreateUserBody, clerkUserId: "different_user" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with missing required fields", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ clerkUserId: "user_test123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid email", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validCreateUserBody, email: "not-an-email" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid phone number", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validCreateUserBody, phoneNumber: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid nationality", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validCreateUserBody, nationality: "XX" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with future date of birth", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validCreateUserBody, dateOfBirth: "2099-01-01" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without auth token", async () => {
      const res = await request(app)
        .post("/api/users")
        .send(validCreateUserBody);

      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/users/update-user", () => {
    it("should update user profile", async () => {
      // dbUser middleware calls getByClerkUserId
      userService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      userService.update.mockResolvedValueOnce({ ...mockUser, firstName: "Jane" });

      const res = await request(app)
        .put("/api/users/update-user")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ firstName: "Jane" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User updated successfully");
    });

    it("should return 400 with empty update body", async () => {
      userService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      const res = await request(app)
        .put("/api/users/update-user")
        .set("x-auth-token", AUTH_TOKEN)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid email in update", async () => {
      userService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      const res = await request(app)
        .put("/api/users/update-user")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ email: "not-valid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
