import { mockUserService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import { mockUser, validCreateUserBody } from "./helpers/mock-data";
import { setupAuthOnly } from "./helpers/test-utils";

const app = createTestApp();

describe("User Endpoints", () => {
  beforeEach(() => {
    setupAuthOnly();
  });

  describe("POST /api/users", () => {
    it("should create a new user", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(null);
      mockUserService.create.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post("/api/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreateUserBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User created successfully");
    });

    it("should update existing user instead of creating duplicate", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      mockUserService.update.mockResolvedValueOnce({ ...mockUser, firstName: "Updated" });

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
      mockUserService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      mockUserService.update.mockResolvedValueOnce({ ...mockUser, firstName: "Jane" });

      const res = await request(app)
        .put("/api/users/update-user")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ firstName: "Jane" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User updated successfully");
    });

    it("should return 400 with empty update body", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      const res = await request(app)
        .put("/api/users/update-user")
        .set("x-auth-token", AUTH_TOKEN)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid email in update", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      const res = await request(app)
        .put("/api/users/update-user")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ email: "not-valid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
