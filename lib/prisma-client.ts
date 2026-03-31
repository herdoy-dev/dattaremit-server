import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({
  connectionString,
  max: 20,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

const prismaClient = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === "production"
      ? ["error", "warn"]
      : ["query", "error", "warn"],
  transactionOptions: {
    maxWait: 10000,
    timeout: 30000,
  },
});

export default prismaClient;
