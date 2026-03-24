import { mockGoogleMapsService } from "./helpers/service-mocks";
import request from "supertest";
import { createTestApp } from "./helpers/app";
import { AUTH_TOKEN } from "./helpers/auth";
import {
  mockAutocompletePredictions,
  mockPlaceDetailsResult,
  mockValidationResult,
  mockValidationNeedsReview,
} from "./helpers/mock-data";
import { setupUserAuth } from "./helpers/test-utils";

const app = createTestApp();

describe("Google Maps Endpoints", () => {
  beforeEach(() => {
    setupUserAuth();
  });

  describe("GET /api/google-maps/autocomplete", () => {
    it("should return address suggestions", async () => {
      mockGoogleMapsService.getAutocompleteSuggestions.mockResolvedValueOnce(
        mockAutocompletePredictions
      );

      const res = await request(app)
        .get("/api/google-maps/autocomplete")
        .query({ input: "123 Main St", country: "US" })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].placeId).toBe(
        mockAutocompletePredictions[0]!.placeId
      );
      expect(res.body.data[0].description).toBe(
        mockAutocompletePredictions[0]!.description
      );
    });

    it("should return empty array when no suggestions found", async () => {
      mockGoogleMapsService.getAutocompleteSuggestions.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/google-maps/autocomplete")
        .query({ input: "xyznonexistent" })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it("should return 400 when input is missing", async () => {
      const res = await request(app)
        .get("/api/google-maps/autocomplete")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when input is too short", async () => {
      const res = await request(app)
        .get("/api/google-maps/autocomplete")
        .query({ input: "ab" })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid country", async () => {
      const res = await request(app)
        .get("/api/google-maps/autocomplete")
        .query({ input: "123 Main St", country: "UK" })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should accept valid session token", async () => {
      mockGoogleMapsService.getAutocompleteSuggestions.mockResolvedValueOnce(
        mockAutocompletePredictions
      );

      const res = await request(app)
        .get("/api/google-maps/autocomplete")
        .query({
          input: "123 Main St",
          sessionToken: "550e8400-e29b-41d4-a716-446655440000",
        })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(
        mockGoogleMapsService.getAutocompleteSuggestions
      ).toHaveBeenCalledWith(
        "123 Main St",
        undefined,
        "550e8400-e29b-41d4-a716-446655440000",
        undefined,
        undefined,
        undefined
      );
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .get("/api/google-maps/autocomplete")
        .query({ input: "123 Main St" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/google-maps/place-details", () => {
    it("should return address components for valid placeId", async () => {
      mockGoogleMapsService.getPlaceDetails.mockResolvedValueOnce(
        mockPlaceDetailsResult
      );

      const res = await request(app)
        .get("/api/google-maps/place-details")
        .query({
          placeId: "ChIJOwg_06VPwokRYv534QaPC8g",
          sessionToken: "550e8400-e29b-41d4-a716-446655440000",
        })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.street).toBe(mockPlaceDetailsResult.street);
      expect(res.body.data.city).toBe(mockPlaceDetailsResult.city);
      expect(res.body.data.postalCode).toBe(mockPlaceDetailsResult.postalCode);
      expect(mockGoogleMapsService.getPlaceDetails).toHaveBeenCalledWith(
        "ChIJOwg_06VPwokRYv534QaPC8g",
        "550e8400-e29b-41d4-a716-446655440000"
      );
    });

    it("should return 400 when placeId is missing", async () => {
      const res = await request(app)
        .get("/api/google-maps/place-details")
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for invalid session token", async () => {
      const res = await request(app)
        .get("/api/google-maps/place-details")
        .query({
          placeId: "ChIJOwg_06VPwokRYv534QaPC8g",
          sessionToken: "not-a-uuid",
        })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .get("/api/google-maps/place-details")
        .query({ placeId: "ChIJOwg_06VPwokRYv534QaPC8g" });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/google-maps/validate-address", () => {
    const validAddressBody = {
      addressLine1: "123 Main St",
      addressLine2: "Apt 4B",
      city: "New York",
      state: "New York",
      country: "US",
      postalCode: "10001",
    };

    it("should return validation result for valid address", async () => {
      mockGoogleMapsService.validateAddress.mockResolvedValueOnce(
        mockValidationResult
      );

      const res = await request(app)
        .post("/api/google-maps/validate-address")
        .send(validAddressBody)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.validationStatus).toBe("VALID");
      expect(res.body.data.formattedAddress).toBeDefined();
    });

    it("should return validation with corrections for needs-review address", async () => {
      mockGoogleMapsService.validateAddress.mockResolvedValueOnce(
        mockValidationNeedsReview
      );

      const res = await request(app)
        .post("/api/google-maps/validate-address")
        .send(validAddressBody)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data.validationStatus).toBe("NEEDS_REVIEW");
      expect(res.body.data.corrections).toBeDefined();
      expect(res.body.data.corrections).toHaveLength(1);
    });

    it("should return 400 when addressLine1 is missing", async () => {
      const { addressLine1, ...bodyWithoutLine1 } = validAddressBody;

      const res = await request(app)
        .post("/api/google-maps/validate-address")
        .send(bodyWithoutLine1)
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when country is invalid", async () => {
      const res = await request(app)
        .post("/api/google-maps/validate-address")
        .send({ ...validAddressBody, country: "UK" })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/google-maps/validate-address")
        .send({ addressLine1: "123 Main St" })
        .set("x-auth-token", AUTH_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app)
        .post("/api/google-maps/validate-address")
        .send(validAddressBody);

      expect(res.status).toBe(401);
    });
  });
});
