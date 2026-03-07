import { mockAddressService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import { mockAddress, validCreateAddressBody } from "./helpers/mock-data";
import { setupUserAuth } from "./helpers/test-utils";

const app = createTestApp();

describe("Address Endpoints", () => {
  beforeEach(() => {
    setupUserAuth();
  });

  describe("GET /api/addresses", () => {
    it("should return all addresses for authenticated user", async () => {
      mockAddressService.getAllByUserId.mockResolvedValueOnce([mockAddress]);

      const res = await request(app)
        .get("/api/addresses")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it("should return empty array when no addresses", async () => {
      mockAddressService.getAllByUserId.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/addresses")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).get("/api/addresses");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/addresses/:id", () => {
    it("should return address by id", async () => {
      mockAddressService.getById.mockResolvedValueOnce(mockAddress);

      const res = await request(app)
        .get(`/api/addresses/${mockAddress.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockAddress.id);
    });

    it("should return 403 when address belongs to another user", async () => {
      mockAddressService.getById.mockResolvedValueOnce({
        ...mockAddress,
        userId: "other-user-id",
      });

      const res = await request(app)
        .get(`/api/addresses/${mockAddress.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/addresses", () => {
    it("should create a new address", async () => {
      mockAddressService.create.mockResolvedValueOnce(mockAddress);

      const res = await request(app)
        .post("/api/addresses")
        .set("x-auth-token", AUTH_TOKEN)
        .send(validCreateAddressBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Address created successfully");
    });

    it("should return 400 with missing required fields", async () => {
      const res = await request(app)
        .post("/api/addresses")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ type: "PRESENT" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid address type", async () => {
      const res = await request(app)
        .post("/api/addresses")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validCreateAddressBody, type: "INVALID" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 with invalid country", async () => {
      const res = await request(app)
        .post("/api/addresses")
        .set("x-auth-token", AUTH_TOKEN)
        .send({ ...validCreateAddressBody, country: "XX" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("PUT /api/addresses/:id", () => {
    it("should update an address", async () => {
      mockAddressService.update.mockResolvedValueOnce({
        ...mockAddress,
        city: "Brooklyn",
      });

      const res = await request(app)
        .put(`/api/addresses/${mockAddress.id}`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({ city: "Brooklyn" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Address updated successfully");
    });

    it("should return 400 with empty update body", async () => {
      const res = await request(app)
        .put(`/api/addresses/${mockAddress.id}`)
        .set("x-auth-token", AUTH_TOKEN)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("DELETE /api/addresses/:id", () => {
    it("should delete an address", async () => {
      mockAddressService.delete.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete(`/api/addresses/${mockAddress.id}`)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Address deleted successfully");
    });
  });
});
