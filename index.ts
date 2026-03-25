import './instrument'
import dotenv from "dotenv";
import * as Sentry from "@sentry/node";

dotenv.config();

// ---------- Startup env validation ----------
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "CLERK_SECRET_KEY",
  "ENCRYPTION_KEY",
  "ZYNK_API_BASE_URL",
  "ZYNK_API_TOKEN",
  "ZYNK_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "GOOGLE_MAPS_API_KEY",
  "ADMIN_API_TOKEN",
] as const;

const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(
    `FATAL: Missing required environment variables: ${missingVars.join(", ")}`,
  );
  process.exit(1);
}

if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY!)) {
  console.error(
    "FATAL: ENCRYPTION_KEY must be exactly 64 hexadecimal characters.",
  );
  process.exit(1);
}
// ---------- End env validation ----------

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import logger from "./lib/logger";
import prismaClient from "./lib/prisma-client";

import auth from "./middlewares/auth";
import error from "./middlewares/error";
import requestId from "./middlewares/request-id";
import { adminRateLimit } from "./middlewares/strict-rate-limit";
import router from "./routes";
import adminRouter from "./routes/admin.routes";
import webhooks from "./routes/webhook.routes";
import exchangeRate from "./routes/exchange-rate.routes";
import referralPublic from "./routes/referral-public.routes";

const app = express();

app.disable("etag");

app.use(requestId);

const corsOrigins: string[] = [
  "https://admin.dattaremit.com",
  "https://refer.dattaremit.com",
  "https://app.dattaremit.com",
];
if (process.env.NODE_ENV !== "production") {
  corsOrigins.push("http://localhost:3000", "http://localhost:3001");
}
app.use(cors({
  origin: corsOrigins,
  exposedHeaders: ["X-Request-Id", "baggage", "sentry-trace"],
}));

app.use(
  helmet({
    xssFilter: true,
    frameguard: { action: "deny" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    dnsPrefetchControl: { allow: false },
    hidePoweredBy: true,
    noSniff: true,
    referrerPolicy: { policy: "no-referrer" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseSrc: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:"],
        upgradeInsecureRequests: [],
      },
    },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  }),
);

app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)"
  );
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: {
      success: false,
      message: "Too many requests. Please try again later.",
    },
  }),
);

app.use(express.json({
  limit: "100kb",
  verify: (req: any, _res, buf) => {
    // Store raw body for webhook HMAC verification
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));


app.get("/health", async (_req, res) => {
  try {
    await prismaClient.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok" });
  } catch (err) {
    logger.error("Health check failed", { error: err });
    res.status(503).json({ status: "error" });
  }
});

app.use("/api", webhooks);
app.use("/api", exchangeRate);
app.use("/api", referralPublic);
app.use("/api/admin", adminRateLimit, adminRouter);
app.use("/api", auth, router);

// Sentry error handler must be after routes but before custom error handler
Sentry.setupExpressErrorHandler(app);

app.use(error);

const port = process.env.PORT || 5000;



const server = app.listen(port, () =>
  logger.info(`Server running on http://localhost:${port}`),
);

// Helper to ensure log is written before continuing
function logAndFlush(
  level: "error" | "info" | "warn",
  message: string,
  meta?: object,
): Promise<void> {
  return new Promise((resolve) => {
    const callback = () => resolve();
    if (meta) {
      logger.log(level, message, meta, callback);
    } else {
      logger.log(level, message, callback);
    }
  });
}

// Shutdown logging
async function shutdown(reason: string, exitCode: number = 0) {
  await logAndFlush("error", `Server shutting down: ${reason}`);

  // Flush buffered Sentry events before shutting down HTTP server
  await Sentry.flush(2000);

  server.close(async () => {
    try {
      await Sentry.close(2000);
      await prismaClient.$disconnect();
      await logAndFlush("error", "Server closed gracefully");
    } catch (err) {
      await logAndFlush("error", "Error during graceful shutdown", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    process.exit(exitCode);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(async () => {
    await logAndFlush("error", "Forcing shutdown after timeout");
    try {
      await prismaClient.$disconnect();
    } catch {
      // Ignore disconnect errors during force shutdown
    }
    process.exit(exitCode);
  }, 10000);
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM", 0);
});

process.on("SIGINT", () => {
  shutdown("SIGINT (Ctrl+C)", 0);
});

process.on("uncaughtException", async (err) => {
  await logAndFlush("error", "Uncaught Exception", {
    error: err.message,
    stack: err.stack,
    name: err.name,
  });
  await shutdown("Uncaught exception", 1);
});

process.on("unhandledRejection", async (reason) => {
  await logAndFlush("error", "Unhandled Promise Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  await shutdown("Unhandled promise rejection", 1);
});
