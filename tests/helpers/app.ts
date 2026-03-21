import "../setup";

// Mock generated prisma client (uses import.meta which fails in CJS/Jest)
const prismaEnums = {
  UserRole: { ADMIN: "ADMIN", USER: "USER", INFLUENCER: "INFLUENCER", PROMOTER: "PROMOTER" },
  AccountStatus: { INITIAL: "INITIAL", ACTIVE: "ACTIVE", PENDING: "PENDING", REJECTED: "REJECTED" },
  ActivityType: {
    DEPOSIT: "DEPOSIT", WITHDRAWAL: "WITHDRAWAL", TRANSFER: "TRANSFER",
    PAYMENT: "PAYMENT", REFUND: "REFUND",
    KYC_SUBMITTED: "KYC_SUBMITTED", KYC_APPROVED: "KYC_APPROVED",
    KYC_REJECTED: "KYC_REJECTED", KYC_FAILED: "KYC_FAILED",
    ACCOUNT_CREATED: "ACCOUNT_CREATED", ACCOUNT_UPDATED: "ACCOUNT_UPDATED",
    ADMIN_ACTION: "ADMIN_ACTION",
  },
  ActivityStatus: { PENDING: "PENDING", FAILED: "FAILED", COMPLETE: "COMPLETE" },
  AddressType: { PRESENT: "PRESENT", PERMANENT: "PERMANENT" },
  NotificationType: {
    KYC_APPROVED: "KYC_APPROVED", KYC_REJECTED: "KYC_REJECTED",
    KYC_FAILED: "KYC_FAILED", KYC_PENDING: "KYC_PENDING",
    ACCOUNT_ACTIVATED: "ACCOUNT_ACTIVATED",
    TRANSACTION_INITIATED: "TRANSACTION_INITIATED",
    TRANSACTION_COMPLETED: "TRANSACTION_COMPLETED",
    TRANSACTION_FAILED: "TRANSACTION_FAILED",
    PROMOTIONAL: "PROMOTIONAL", SYSTEM_ALERT: "SYSTEM_ALERT",
    REFERRAL_BONUS: "REFERRAL_BONUS",
  },
  DevicePlatform: { IOS: "IOS", ANDROID: "ANDROID" },
};

jest.mock("../../generated/prisma/client", () => ({
  ...prismaEnums,
  Prisma: {
    ModelName: {},
    JsonNull: null,
    InputJsonValue: {},
  },
  PrismaClient: jest.fn(),
}));

jest.mock("../../generated/prisma/enums", () => prismaEnums);

// Mock external modules before importing app modules
jest.mock("@clerk/express", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("../../lib/prisma-client", () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    address: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    activity: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn({
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      activity: {
        create: jest.fn(),
      },
    })),
  },
}));

jest.mock("../../lib/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock("../../services/email.service", () => ({
  sendKycEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../lib/crypto", () => ({
  __esModule: true,
  sha256: jest.fn().mockResolvedValue("mocked-hash"),
  encrypt: jest.fn((val: string) => `encrypted:${val}`),
  decrypt: jest.fn((val: string) => val.replace("encrypted:", "")),
}));

jest.mock("../../lib/activity-logger", () => ({
  __esModule: true,
  default: {
    logActivity: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../lib/notification-logger", () => ({
  __esModule: true,
  default: {
    notify: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock("expo-server-sdk", () => ({
  __esModule: true,
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: jest.fn().mockReturnValue([]),
    sendPushNotificationsAsync: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("../../lib/expo-client", () => ({
  __esModule: true,
  default: {
    chunkPushNotifications: jest.fn().mockReturnValue([]),
    sendPushNotificationsAsync: jest.fn().mockResolvedValue([]),
  },
}));

// Now import the actual modules
import cors from "cors";
import express from "express";
import helmet from "helmet";
import error from "../../middlewares/error";
import requestId from "../../middlewares/request-id";
import auth from "../../middlewares/auth";
import router from "../../routes";
import adminRouter from "../../routes/admin.routes";
import webhooks from "../../routes/webhook.routes";
import exchangeRate from "../../routes/exchange-rate.routes";
import referralPublic from "../../routes/referral-public.routes";

export function createTestApp() {
  const app = express();

  app.use(requestId);
  app.use(cors({
    origin: [
      "https://admin.dattaremit.com",
      "https://refer.dattaremit.com",
      "https://app.dattaremit.com",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
  }));
  app.use(helmet());

  app.use(express.json({
    limit: "100kb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));

  // Health check
  const prismaClient = require("../../lib/prisma-client").default;
  app.get("/health", async (_req, res) => {
    try {
      await prismaClient.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: "healthy",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: "unhealthy",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.use("/api", webhooks);
  app.use("/api", exchangeRate);
  app.use("/api", referralPublic);
  app.use("/api/admin", adminRouter);
  app.use("/api", auth, router);
  app.use(error);

  return app;
}
