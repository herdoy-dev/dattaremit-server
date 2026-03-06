import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockAuthAsUser, mockAuthFailure, AUTH_TOKEN } from "./helpers/auth";

const app = createTestApp();

describe("Middleware Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Auth Middleware", () => {
    it("should return 401 when no token provided", async () => {
      const res = await request(app).get("/api/account");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Access denied. No token provided.");
    });

    it("should return 401 with invalid token", async () => {
      mockAuthFailure();

      const res = await request(app)
        .get("/api/account")
        .set("x-auth-token", "bad-token");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should pass with valid token", async () => {
      mockAuthAsUser();

      // This will get through auth but may fail at service level - that's fine
      const res = await request(app)
        .get("/api/account")
        .set("x-auth-token", AUTH_TOKEN);

      // Should NOT be 401 - auth passed
      expect(res.status).not.toBe(401);
    });
  });

  describe("Error Handler", () => {
    it("should return standardized error format for AppError", async () => {
      const res = await request(app).get("/api/account");

      expect(res.body).toHaveProperty("success");
      expect(res.body).toHaveProperty("message");
      expect(typeof res.body.success).toBe("boolean");
      expect(typeof res.body.message).toBe("string");
    });
  });

  describe("Request ID", () => {
    it("should add x-request-id header when not provided", async () => {
      const res = await request(app).get("/health");

      // Header name is case-insensitive in HTTP; supertest lowercases
      expect(res.headers["x-request-id"]).toBeDefined();
    });

    it("should use provided x-request-id", async () => {
      const res = await request(app)
        .get("/health")
        .set("x-request-id", "custom-request-id");

      expect(res.headers["x-request-id"]).toBe("custom-request-id");
    });
  });

  describe("Security Headers", () => {
    it("should include security headers from helmet", async () => {
      const res = await request(app).get("/health");

      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    });
  });
});
