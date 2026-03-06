import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { createSearchHash, decrypt, encrypt, isEncrypted } from "./crypto";
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
  } catch {
    logger.error("Field decryption failed");
  }
};

/**
 * Convert dateOfBirth value to string format for encryption
 */
const convertDateToString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && !isEncrypted(value)) return value;
  return "";
};

/**
 * Type-safe wrapper for encrypting Prisma args data
 * Encapsulates type casting to satisfy SonarQube S4325
 */
const encryptPrismaData = <T>(data: T): T => {
  return encryptUserData(data as Record<string, unknown>) as T;
};

/**
 * Type-safe wrapper for transforming Prisma where clause
 * Encapsulates type casting to satisfy SonarQube S4325
 */
const transformPrismaWhere = <T>(where: T): T => {
  return transformEmailWhere(where as Record<string, unknown>) as T;
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

/**
 * Encrypt sensitive fields before saving to database
 * Refactored to reduce cognitive complexity (SonarQube S3776)
 */
export const encryptUserData = <T extends Record<string, unknown>>(
  data: T
): T => {
  const encrypted = { ...data } as Record<string, unknown>;

  // Encrypt email and generate hash for lookups
  const email = encrypted.email;
  if (email && typeof email === "string" && !isEncrypted(email)) {
    encrypted.emailHash = createSearchHash(email);
    encrypted.email = encrypt(email);
  }

  // Encrypt dateOfBirth (convert Date to ISO string if needed)
  if (encrypted.dateOfBirth) {
    const dateString = convertDateToString(encrypted.dateOfBirth);
    if (dateString) {
      encrypted.dateOfBirth = encrypt(dateString);
    }
  }

  // Encrypt other sensitive fields using helper
  encryptField(encrypted, "phoneNumber");
  encryptField(encrypted, "phoneNumberPrefix");

  return encrypted as T;
};

/**
 * Decrypt sensitive fields after reading from database
 * Refactored to reduce cognitive complexity (SonarQube S3776)
 */
export const decryptUserData = <T>(user: T): T => {
  if (!user || typeof user !== "object") return user;

  const decrypted = { ...user } as Record<string, unknown>;

  // Decrypt all sensitive fields using helper
  decryptField(decrypted, "email");
  decryptField(decrypted, "dateOfBirth");
  decryptField(decrypted, "phoneNumber");
  decryptField(decrypted, "phoneNumberPrefix");

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

/**
 * Transform email lookup to use emailHash
 * Fixed: Removed unnecessary type assertion (SonarQube S4325)
 */
const transformEmailWhere = <T extends Record<string, unknown>>(
  where: T
): T => {
  if (where?.email && typeof where.email === "string") {
    const transformed = { ...where } as Record<string, unknown>;
    transformed.emailHash = createSearchHash(where.email);
    delete transformed.email;
    return transformed as T;
  }
  return where;
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
        if (args.where) {
          args.where = transformPrismaWhere(args.where);
        }
        const result = await query(args);
        return decryptUserData(result);
      },
      async findUniqueOrThrow({ args, query }) {
        if (args.where) {
          args.where = transformPrismaWhere(args.where);
        }
        const result = await query(args);
        return decryptUserData(result);
      },
      async findFirst({ args, query }) {
        if (args.where) {
          args.where = transformPrismaWhere(args.where);
        }
        const result = await query(args);
        return decryptUserData(result);
      },
      async findFirstOrThrow({ args, query }) {
        if (args.where) {
          args.where = transformPrismaWhere(args.where);
        }
        const result = await query(args);
        return decryptUserData(result);
      },
      async findMany({ args, query }) {
        if (args.where) {
          args.where = transformPrismaWhere(args.where);
        }
        const result = await query(args);
        return decryptQueryResult(result);
      },
    },
  },
});

export default prismaClient;