import { mockUserService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import { mockUser } from "./helpers/mock-data";
import { setupAuthOnly } from "./helpers/test-utils";

const app = createTestApp();

describe("Referral Endpoints", () => {
  beforeEach(() => {
    setupAuthOnly();
  });

  describe("POST /api/referral/validate", () => {
    it("should validate a valid referral code", async () => {
      mockUserService.validateReferCode.mockResolvedValueOnce({ valid: true, referrerName: "John" });

      const res = await request(app)
        .post("/api/referral/validate")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ code: "JOHN123" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
    });

    it("should return 400 when code is missing", async () => {
      const res = await request(app)
        .post("/api/referral/validate")
        .set("x-auth-token", AUTH_TOKEN)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when code is not a string", async () => {
      const res = await request(app)
        .post("/api/referral/validate")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ code: 123 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/referral/request-code", () => {
    it("should generate a referral code for the user", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(mockUser);
      mockUserService.requestReferCode.mockResolvedValueOnce({ referCode: "JOHND123" });

      const res = await request(app)
        .post("/api/referral/request-code")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referCode).toBe("JOHND123");
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).post("/api/referral/request-code");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/referral/tracker/:referCode (public)", () => {
    it("should return tracker stats for a referral code", async () => {
      mockUserService.getReferralTrackerStats.mockResolvedValueOnce({
        referCode: "JOHND123",
        totalReferrals: 5,
        activeReferrals: 3,
      });

      const res = await request(app).get("/api/referral/tracker/johnd123");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalReferrals).toBe(5);
    });
  });
});
