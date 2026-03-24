import request from "supertest";
import { createTestApp } from "./helpers/app";
import prismaClient from "../lib/prisma-client";

const app = createTestApp();

describe("GET /health", () => {
  it("should return healthy when database is connected", async () => {
    jest.mocked(prismaClient.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.database).toBe("connected");
    expect(res.body.timestamp).toBeDefined();
  });

  it("should return unhealthy when database is disconnected", async () => {
    jest.mocked(prismaClient.$queryRaw).mockRejectedValueOnce(new Error("Connection failed"));

    const res = await request(app).get("/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("unhealthy");
    expect(res.body.database).toBe("disconnected");
  });
});
