import request from "supertest";
import { createTestApp } from "./helpers/app";

const app = createTestApp();
const prismaClient = require("../lib/prisma-client").default;

describe("GET /health", () => {
  it("should return healthy when database is connected", async () => {
    prismaClient.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.database).toBe("connected");
    expect(res.body.timestamp).toBeDefined();
  });

  it("should return unhealthy when database is disconnected", async () => {
    prismaClient.$queryRaw.mockRejectedValueOnce(new Error("Connection failed"));

    const res = await request(app).get("/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("unhealthy");
    expect(res.body.database).toBe("disconnected");
  });
});
