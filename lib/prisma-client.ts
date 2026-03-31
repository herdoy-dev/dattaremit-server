import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { decrypt, encrypt, isEncrypted } from "./crypto";
import logger from "./logger";

const connectionString = `${process.env.DATABASE_URL}`;

// =============================================================================
// Helper Functions for Field Encryption/Decryption (reduces cognitive complexity)
// =============================================================================

/**
 * Encrypt a single string field if not already encrypted
 */
const encryptField = (
  data: Record<string, unknown>,
  fieldName: string
): void => {
  const value = data[fieldName];
  if (value && typeof value === "string" && !isEncrypted(value)) {
    data[fieldName] = encrypt(value);
  }
};

/**
 * Decrypt a single string field if encrypted
 */
const decryptField = (
  data: Record<string, unknown>,
  fieldName: string
): void => {
  const value = data[fieldName];
  if (!value || typeof value !== "string" || !isEncrypted(value)) return;

  try {
    data[fieldName] = decrypt(value);
  } catch (error) {
    logger.error(`Decryption failed for field "${fieldName}"`, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error(`Data integrity error: failed to decrypt field "${fieldName}"`);
  }
};

/**
 * Type-safe wrapper for encrypting Prisma args data
 * Encapsulates type casting to satisfy SonarQube S4325
 */
const encryptPrismaData = <T>(data: T): T => {
  return encryptUserData(data as Record<string, unknown>) as T;
};

const adapter = new PrismaPg({
  connectionString,
  max: 20,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

const basePrismaClient = new PrismaClient({
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

// Fields encrypted: phoneNumber, phoneNumberPrefix, nationality

/**
 * Encrypt sensitive fields before saving to database
 */
export const encryptUserData = <T extends Record<string, unknown>>(
  data: T
): T => {
  const encrypted = { ...data } as Record<string, unknown>;

  encryptField(encrypted, "phoneNumber");
  encryptField(encrypted, "phoneNumberPrefix");
  encryptField(encrypted, "nationality");

  return encrypted as T;
};

/**
 * Decrypt sensitive fields after reading from database
 * Refactored to reduce cognitive complexity (SonarQube S3776)
 */
export const decryptUserData = <T>(user: T): T => {
  if (!user || typeof user !== "object") return user;

  const decrypted = { ...user } as Record<string, unknown>;

  decryptField(decrypted, "phoneNumber");
  decryptField(decrypted, "phoneNumberPrefix");
  decryptField(decrypted, "nationality");

  return decrypted as T;
};

/**
 * Decrypt nested user in objects that include user relation
 * Use this for transaction results that include { user: true }
 */
export const decryptNestedUser = <T extends { user?: unknown }>(obj: T): T => {
  if (!obj) return obj;
  if (obj.user && typeof obj.user === "object") {
    return { ...obj, user: decryptUserData(obj.user) };
  }
  return obj;
};

/**
 * Decrypt user data in query results (handles single user, arrays, and nested relations)
 */
const decryptQueryResult = <T>(result: T): T => {
  if (!result) return result;

  if (Array.isArray(result)) {
    return result.map((item) => decryptUserData(item)) as T;
  }

  return decryptUserData(result);
};

// Prisma Client Extension for automatic encryption/decryption
const prismaClient = basePrismaClient.$extends({
  query: {
    user: {
      async create({ args, query }) {
        if (args.data) {
          args.data = encryptPrismaData(args.data);
        }
        const result = await query(args);
        return decryptUserData(result);
      },
      async createMany({ args, query }) {
        if (args.data && Array.isArray(args.data)) {
          args.data = args.data.map(encryptPrismaData);
        }
        return query(args);
      },
      async update({ args, query }) {
        if (args.data) {
          args.data = encryptPrismaData(args.data);
        }
        const result = await query(args);
        return decryptUserData(result);
      },
      async updateMany({ args, query }) {
        if (args.data) {
          args.data = encryptPrismaData(args.data);
        }
        return query(args);
      },
      async upsert({ args, query }) {
        if (args.create) {
          args.create = encryptPrismaData(args.create);
        }
        if (args.update) {
          args.update = encryptPrismaData(args.update);
        }
        const result = await query(args);
        return decryptUserData(result);
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        return decryptUserData(result);
      },
      async findUniqueOrThrow({ args, query }) {
        const result = await query(args);
        return decryptUserData(result);
      },
      async findFirst({ args, query }) {
        const result = await query(args);
        return decryptUserData(result);
      },
      async findFirstOrThrow({ args, query }) {
        const result = await query(args);
        return decryptUserData(result);
      },
      async findMany({ args, query }) {
        const result = await query(args);
        return decryptQueryResult(result);
      },
    },
  },
});

export default prismaClient;