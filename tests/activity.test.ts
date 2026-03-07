import { mockActivityService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import { mockActivity } from "./helpers/mock-data";
import { setupUserAuth } from "./helpers/test-utils";

const app = createTestApp();

describe("Activity Endpoints", () => {
  beforeEach(() => {
    setupUserAuth();
  });

  describe("GET /api/activity", () => {
    it("should return paginated activities", async () => {
      mockActivityService.getActivities.mockResolvedValueOnce({
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
      mockActivityService.getActivities.mockResolvedValueOnce({
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
      mockActivityService.getById.mockResolvedValueOnce(mockActivity);

      const res = await request(app)
        .get(`/api/activity/${mockActivity.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockActivity.id);
    });

    it("should return 404 when activity belongs to another user", async () => {
      mockActivityService.getById.mockResolvedValueOnce({
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
