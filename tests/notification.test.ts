import { mockNotificationService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import { mockNotification, mockReadNotification } from "./helpers/mock-data";
import { setupUserAuth } from "./helpers/test-utils";
import AppError from "../lib/AppError";

const app = createTestApp();

describe("Notification Endpoints", () => {
  beforeEach(() => {
    setupUserAuth();
  });

  describe("GET /api/notifications", () => {
    it("should return paginated notifications", async () => {
      mockNotificationService.getByUserId.mockResolvedValueOnce({
        items: [mockNotification],
        total: 1,
      });

      const res = await request(app)
        .get("/api/notifications")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.limit).toBe(20);
      expect(res.body.data.offset).toBe(0);
    });

    it("should support pagination query params", async () => {
      mockNotificationService.getByUserId.mockResolvedValueOnce({
        items: [],
        total: 0,
      });

      const res = await request(app)
        .get("/api/notifications?limit=10&offset=5")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(10);
      expect(res.body.data.offset).toBe(5);
    });

    it("should support isRead filter", async () => {
      mockNotificationService.getByUserId.mockResolvedValueOnce({
        items: [mockReadNotification],
        total: 1,
      });

      const res = await request(app)
        .get("/api/notifications?isRead=true")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 400 with limit exceeding max", async () => {
      const res = await request(app)
        .get("/api/notifications?limit=999")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    it("should return unread count", async () => {
      mockNotificationService.getUnreadCount.mockResolvedValueOnce(5);

      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(5);
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("should mark notification as read", async () => {
      mockNotificationService.markAsRead.mockResolvedValueOnce({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      const res = await request(app)
        .patch(`/api/notifications/${mockNotification.id}/read`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Notification marked as read");
    });

    it("should return 404 for non-existent notification", async () => {
      mockNotificationService.markAsRead.mockRejectedValueOnce(
        new AppError(404, "Notification not found")
      );

      const res = await request(app)
        .patch(
          `/api/notifications/880e8400-e29b-41d4-a716-446655440099/read`
        )
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(404);
    });

    it("should return 400 with invalid UUID", async () => {
      const res = await request(app)
        .patch("/api/notifications/not-a-uuid/read")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PATCH /api/notifications/read-all", () => {
    it("should mark all notifications as read", async () => {
      mockNotificationService.markAllAsRead.mockResolvedValueOnce({
        count: 3,
      });

      const res = await request(app)
        .patch("/api/notifications/read-all")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("All notifications marked as read");
    });
  });

  describe("DELETE /api/notifications/:id", () => {
    it("should delete notification", async () => {
      mockNotificationService.delete.mockResolvedValueOnce(mockNotification);

      const res = await request(app)
        .delete(`/api/notifications/${mockNotification.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Notification deleted successfully");
    });

    it("should return 404 for non-existent notification", async () => {
      mockNotificationService.delete.mockRejectedValueOnce(
        new AppError(404, "Notification not found")
      );

      const res = await request(app)
        .delete(
          `/api/notifications/880e8400-e29b-41d4-a716-446655440099`
        )
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(404);
    });

    it("should return 400 with invalid UUID", async () => {
      const res = await request(app)
        .delete("/api/notifications/not-a-uuid")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
