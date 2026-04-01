import { mockUserService, mockAdminService, mockAdminChartService, mockAdminPromoterService, mockAppSettingService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import {
  mockUser,
  validAdminCreateUserBody,
  validCreatePromoterBody,
} from "./helpers/mock-data";
import { setupAdminAuth } from "./helpers/test-utils";

const app = createTestApp();

describe("Admin Endpoints", () => {
  beforeEach(() => {
    setupAdminAuth();
  });

  describe("Authentication & Authorization", () => {
    it("should return 401 without auth token", async () => {
      const res = await request(app).get("/api/admin/stats");
      expect(res.status).toBe(401);
    });

    it("should return 403 for non-admin user", async () => {
      mockUserService.getByClerkUserId.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .get("/api/admin/stats")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/admin/stats", () => {
    it("should return dashboard stats", async () => {
      mockAdminChartService.getDashboardStats.mockResolvedValueOnce({
        totalUsers: 100,
        activeUsers: 80,
        pendingKyc: 10,
      });

      const res = await request(app)
        .get("/api/admin/stats")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBe(100);
    });
  });

  describe("GET /api/admin/users", () => {
    it("should return paginated users", async () => {
      mockAdminService.getUsers.mockResolvedValueOnce({
        users: [mockUser],
        total: 1,
        page: 1,
        limit: 20,
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
    });

    it("should support pagination params", async () => {
      mockAdminService.getUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      const res = await request(app)
        .get("/api/admin/users?page=2&limit=10")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(2, 10, undefined, undefined);
    });

    it("should filter by status", async () => {
      mockAdminService.getUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/admin/users?status=ACTIVE")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(1, 20, undefined, "ACTIVE");
    });

    it("should support search", async () => {
      mockAdminService.getUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/admin/users?search=john")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(mockAdminService.getUsers).toHaveBeenCalledWith(1, 20, "john", undefined);
    });

    it("should cap limit at 100", async () => {
      mockAdminService.getUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
      });

      await request(app)
        .get("/api/admin/users?limit=500")
        .set("x-auth-token", AUTH_TOKEN);

      expect(mockAdminService.getUsers).toHaveBeenCalledWith(1, 100, undefined, undefined);
    });
  });

  describe("POST /api/admin/users", () => {
    it("should create a user", async () => {
      mockAdminService.createUser.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post("/api/admin/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validAdminCreateUserBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User created successfully");
    });

    it("should return 400 with missing fields", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ firstName: "Test" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid email", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validAdminCreateUserBody, email: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/admin/users/:id", () => {
    it("should return user by id", async () => {
      mockAdminService.getUserById.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .get(`/api/admin/users/${mockUser.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("PUT /api/admin/users/:id", () => {
    it("should update a user", async () => {
      mockAdminService.updateUser.mockResolvedValueOnce({
        ...mockUser,
        firstName: "Updated",
      });

      const res = await request(app)
        .put(`/api/admin/users/${mockUser.id}`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({ firstName: "Updated" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 400 with empty body", async () => {
      const res = await request(app)
        .put(`/api/admin/users/${mockUser.id}`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/admin/users/:id", () => {
    it("should delete a user", async () => {
      mockAdminService.deleteUser.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete(`/api/admin/users/${mockUser.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User deleted successfully");
    });
  });

  describe("PATCH /api/admin/users/:id/role", () => {
    it("should change user role", async () => {
      mockAdminService.changeUserRole.mockResolvedValueOnce({
        ...mockUser,
        role: "ADMIN",
      });

      const res = await request(app)
        .patch(`/api/admin/users/${mockUser.id}/role`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({ role: "ADMIN" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 400 with invalid role", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${mockUser.id}/role`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({ role: "SUPERADMIN" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 without role", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${mockUser.id}/role`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PATCH /api/admin/users/:id/ach-push", () => {
    it("should toggle ACH push", async () => {
      mockAdminService.toggleAchPush.mockResolvedValueOnce({
        ...mockUser,
        achPushEnabled: true,
      });

      const res = await request(app)
        .patch(`/api/admin/users/${mockUser.id}/ach-push`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 400 when enabled is not boolean", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${mockUser.id}/ach-push`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({ enabled: "yes" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/admin/activities", () => {
    it("should return paginated activities", async () => {
      mockAdminService.getActivities.mockResolvedValueOnce({
        activities: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/admin/activities")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Chart Endpoints", () => {
    it("GET /api/admin/charts/registrations", async () => {
      mockAdminChartService.getRegistrationChart.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/admin/charts/registrations")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/charts/activity-types", async () => {
      mockAdminChartService.getActivityTypeChart.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/admin/charts/activity-types")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/charts/account-status", async () => {
      mockAdminChartService.getAccountStatusChart.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/admin/charts/account-status")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/charts/kyc", async () => {
      mockAdminChartService.getKycActivityChart.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/admin/charts/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/admin/referral-stats", () => {
    it("should return referral stats", async () => {
      mockAdminPromoterService.getReferralStats.mockResolvedValueOnce({
        stats: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/admin/referral-stats")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Settings Endpoints", () => {
    it("GET /api/admin/settings should return settings", async () => {
      mockAppSettingService.getAllSettings.mockResolvedValueOnce({
        WEEKLY_TRANSFER_LIMIT_USD: {
          value: "10000",
          updatedBy: null,
          updated_at: null,
        },
      });

      const res = await request(app)
        .get("/api/admin/settings")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.WEEKLY_TRANSFER_LIMIT_USD.value).toBe("10000");
    });

    it("PUT /api/admin/settings should update a setting", async () => {
      mockAppSettingService.updateSetting.mockResolvedValueOnce({
        id: "setting-uuid",
        key: "WEEKLY_TRANSFER_LIMIT_USD",
        value: "5000",
        updatedBy: "admin-uuid",
        updated_at: new Date().toISOString(),
      });

      const res = await request(app)
        .put("/api/admin/settings")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ key: "WEEKLY_TRANSFER_LIMIT_USD", value: "5000" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Setting updated successfully");
    });

    it("PUT /api/admin/settings should return 400 without key", async () => {
      const res = await request(app)
        .put("/api/admin/settings")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ value: "5000" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("PUT /api/admin/settings should return 400 without value", async () => {
      const res = await request(app)
        .put("/api/admin/settings")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ key: "WEEKLY_TRANSFER_LIMIT_USD" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Marketing Endpoints", () => {
    it("GET /api/admin/marketing/stats", async () => {
      mockAdminPromoterService.getMarketingStats.mockResolvedValueOnce({
        totalPromoters: 10,
      });

      const res = await request(app)
        .get("/api/admin/marketing/stats")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/marketing/promoters", async () => {
      mockAdminPromoterService.getPromoters.mockResolvedValueOnce({
        promoters: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/admin/marketing/promoters")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/marketing/promoters/preview-refer-code", async () => {
      mockAdminPromoterService.previewReferCode.mockResolvedValueOnce({
        referCode: "JOHNS123",
      });

      const res = await request(app)
        .get("/api/admin/marketing/promoters/preview-refer-code?firstName=John&lastName=Smith")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referCode).toBe("JOHNS123");
    });

    it("should return 400 for preview without names", async () => {
      const res = await request(app)
        .get("/api/admin/marketing/promoters/preview-refer-code")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("POST /api/admin/marketing/promoters", async () => {
      mockAdminPromoterService.createPromoter.mockResolvedValueOnce({
        ...mockUser,
        role: "PROMOTER",
        referCode: "PROMOU123",
      });

      const res = await request(app)
        .post("/api/admin/marketing/promoters")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreatePromoterBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Promoter created successfully");
    });

    it("should return 400 with invalid promoter role", async () => {
      const res = await request(app)
        .post("/api/admin/marketing/promoters")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validCreatePromoterBody, role: "ADMIN" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 without referValue", async () => {
      const { referValue, ...body } = validCreatePromoterBody;
      const res = await request(app)
        .post("/api/admin/marketing/promoters")
        .set("x-auth-token", AUTH_TOKEN)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
