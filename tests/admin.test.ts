import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockAuthAsAdmin, AUTH_TOKEN } from "./helpers/auth";
import {
  mockAdminUser,
  mockUser,
  validAdminCreateUserBody,
  validCreatePromoterBody,
} from "./helpers/mock-data";

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

jest.mock("../services/admin.service", () => ({
  __esModule: true,
  default: {
    getDashboardStats: jest.fn(),
    getUsers: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    changeUserRole: jest.fn(),
    toggleAchPush: jest.fn(),
    getActivities: jest.fn(),
    getRegistrationChart: jest.fn(),
    getActivityTypeChart: jest.fn(),
    getAccountStatusChart: jest.fn(),
    getKycActivityChart: jest.fn(),
    createPromoter: jest.fn(),
    previewReferCode: jest.fn(),
    getPromoters: jest.fn(),
    getMarketingStats: jest.fn(),
    getReferralStats: jest.fn(),
  },
}));

const userService = require("../services/user.service").default;
const adminService = require("../services/admin.service").default;

describe("Admin Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthAsAdmin();
    // adminAuth middleware fetches user
    userService.getByClerkUserId.mockResolvedValue(mockAdminUser);
  });

  describe("Authentication & Authorization", () => {
    it("should return 401 without auth token", async () => {
      const res = await request(app).get("/api/admin/stats");
      expect(res.status).toBe(401);
    });

    it("should return 403 for non-admin user", async () => {
      userService.getByClerkUserId.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .get("/api/admin/stats")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/admin/stats", () => {
    it("should return dashboard stats", async () => {
      adminService.getDashboardStats.mockResolvedValueOnce({
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
      adminService.getUsers.mockResolvedValueOnce({
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
      adminService.getUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      const res = await request(app)
        .get("/api/admin/users?page=2&limit=10")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(adminService.getUsers).toHaveBeenCalledWith(2, 10, undefined, undefined);
    });

    it("should filter by status", async () => {
      adminService.getUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/admin/users?status=ACTIVE")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(adminService.getUsers).toHaveBeenCalledWith(1, 20, undefined, "ACTIVE");
    });

    it("should support search", async () => {
      adminService.getUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/admin/users?search=john")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(adminService.getUsers).toHaveBeenCalledWith(1, 20, "john", undefined);
    });

    it("should cap limit at 100", async () => {
      adminService.getUsers.mockResolvedValueOnce({
        users: [],
        total: 0,
      });

      await request(app)
        .get("/api/admin/users?limit=500")
        .set("x-auth-token", AUTH_TOKEN);

      expect(adminService.getUsers).toHaveBeenCalledWith(1, 100, undefined, undefined);
    });
  });

  describe("POST /api/admin/users", () => {
    it("should create a user", async () => {
      adminService.createUser.mockResolvedValueOnce(mockUser);

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
      adminService.getUserById.mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .get(`/api/admin/users/${mockUser.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("PUT /api/admin/users/:id", () => {
    it("should update a user", async () => {
      adminService.updateUser.mockResolvedValueOnce({
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
      adminService.deleteUser.mockResolvedValueOnce(undefined);

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
      adminService.changeUserRole.mockResolvedValueOnce({
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
      adminService.toggleAchPush.mockResolvedValueOnce({
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
      adminService.getActivities.mockResolvedValueOnce({
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
      adminService.getRegistrationChart.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/admin/charts/registrations")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/charts/activity-types", async () => {
      adminService.getActivityTypeChart.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/admin/charts/activity-types")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/charts/account-status", async () => {
      adminService.getAccountStatusChart.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/admin/charts/account-status")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/charts/kyc", async () => {
      adminService.getKycActivityChart.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/admin/charts/kyc")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/admin/referral-stats", () => {
    it("should return referral stats", async () => {
      adminService.getReferralStats.mockResolvedValueOnce({
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

  describe("Marketing Endpoints", () => {
    it("GET /api/admin/marketing/stats", async () => {
      adminService.getMarketingStats.mockResolvedValueOnce({
        totalPromoters: 10,
      });

      const res = await request(app)
        .get("/api/admin/marketing/stats")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("GET /api/admin/marketing/promoters", async () => {
      adminService.getPromoters.mockResolvedValueOnce({
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
      adminService.previewReferCode.mockResolvedValueOnce({
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
      adminService.createPromoter.mockResolvedValueOnce({
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
