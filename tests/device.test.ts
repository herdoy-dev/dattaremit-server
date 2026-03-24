import { mockDeviceService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import { mockDevice, validRegisterDeviceBody } from "./helpers/mock-data";
import { setupUserAuth } from "./helpers/test-utils";
import AppError from "../lib/AppError";

const app = createTestApp();

describe("Device Endpoints", () => {
  beforeEach(() => {
    setupUserAuth();
  });

  describe("POST /api/devices/register", () => {
    it("should register a device", async () => {
      mockDeviceService.register.mockResolvedValueOnce(mockDevice);

      const res = await request(app)
        .post("/api/devices/register")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validRegisterDeviceBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Device registered successfully");
      expect(res.body.data.expoPushToken).toBe(mockDevice.expoPushToken);
    });

    it("should return 400 with invalid expo token format", async () => {
      const res = await request(app)
        .post("/api/devices/register")
        .set("x-auth-token", AUTH_TOKEN)
        .send({
          expoPushToken: "invalid-token",
          platform: "IOS",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with missing platform", async () => {
      const res = await request(app)
        .post("/api/devices/register")
        .set("x-auth-token", AUTH_TOKEN)
        .send({
          expoPushToken: "ExponentPushToken[test-token]",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid platform", async () => {
      const res = await request(app)
        .post("/api/devices/register")
        .set("x-auth-token", AUTH_TOKEN)
        .send({
          expoPushToken: "ExponentPushToken[test-token]",
          platform: "WINDOWS",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should register without optional deviceName", async () => {
      mockDeviceService.register.mockResolvedValueOnce({
        ...mockDevice,
        deviceName: null,
      });

      const res = await request(app)
        .post("/api/devices/register")
        .set("x-auth-token", AUTH_TOKEN)
        .send({
          expoPushToken: "ExponentPushToken[test-token-456]",
          platform: "ANDROID",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/devices/register")
        .send(validRegisterDeviceBody);

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/devices/:id", () => {
    it("should unregister a device", async () => {
      mockDeviceService.unregister.mockResolvedValueOnce(mockDevice);

      const res = await request(app)
        .delete(`/api/devices/${mockDevice.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Device unregistered successfully");
    });

    it("should return 404 for non-existent device", async () => {
      mockDeviceService.unregister.mockRejectedValueOnce(
        new AppError(404, "Device not found")
      );

      const res = await request(app)
        .delete(`/api/devices/990e8400-e29b-41d4-a716-446655440099`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(404);
    });

    it("should return 400 with invalid UUID", async () => {
      const res = await request(app)
        .delete("/api/devices/not-a-uuid")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).delete(`/api/devices/${mockDevice.id}`);
      expect(res.status).toBe(401);
    });
  });
});
