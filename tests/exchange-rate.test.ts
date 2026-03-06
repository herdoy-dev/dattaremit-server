import request from "supertest";
import { createTestApp } from "./helpers/app";

const app = createTestApp();

jest.mock("../services/exchange-rate.service", () => ({
  __esModule: true,
  default: {
    getRate: jest.fn(),
  },
}));

const exchangeRateService = require("../services/exchange-rate.service").default;

describe("GET /api/exchange-rate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return exchange rate data", async () => {
    exchangeRateService.getRate.mockResolvedValueOnce({
      rate: 83.5,
      updatedAt: "2026-03-07T00:00:00.000Z",
      stale: false,
    });

    const res = await request(app).get("/api/exchange-rate");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rate).toBe(83.5);
    expect(res.body.data.stale).toBe(false);
  });

  it("should return 500 when service fails", async () => {
    exchangeRateService.getRate.mockRejectedValueOnce(new Error("API down"));

    const res = await request(app).get("/api/exchange-rate");

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
