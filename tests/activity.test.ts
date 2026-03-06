import request from "supertest";
import { createTestApp } from "./helpers/app";
import { mockAuthAsUser, AUTH_TOKEN } from "./helpers/auth";
import { mockUser, mockActivity } from "./helpers/mock-data";


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

jest.mock("../services/activity.service", () => ({
  __esModule: true,
  default: {
    getActivities: jest.fn(),
    getById: jest.fn(),
  },
}));

const userService = require("../services/user.service").default;
const activityService = require("../services/activity.service").default;

describe("Activity Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthAsUser();
    // dbUser middleware needs this
    userService.getByClerkUserId.mockResolvedValue(mockUser);
  });

  describe("GET /api/activity", () => {
    it("should return paginated activities", async () => {
      activityService.getActivities.mockResolvedValueOnce({
        items: [mockActivity],
        total: 1,
      });

      const res = await request(app)
        .get("/api/activity")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.limit).toBe(20);
      expect(res.body.data.offset).toBe(0);
    });

    it("should support pagination query params", async () => {
      activityService.getActivities.mockResolvedValueOnce({
        items: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/activity?limit=10&offset=5")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(10);
      expect(res.body.data.offset).toBe(5);
    });

    it("should return 400 with invalid limit", async () => {
      const res = await request(app)
        .get("/api/activity?limit=999")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/activity");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/activity/:id", () => {
    it("should return activity by id", async () => {
      activityService.getById.mockResolvedValueOnce(mockActivity);

      const res = await request(app)
        .get(`/api/activity/${mockActivity.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockActivity.id);
    });

    it("should return 404 when activity belongs to another user", async () => {
      activityService.getById.mockResolvedValueOnce({
        ...mockActivity,
        userId: "other-user-id",
      });

      const res = await request(app)
        .get(`/api/activity/${mockActivity.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid UUID", async () => {
      const res = await request(app)
        .get("/api/activity/not-a-uuid")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
