import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import logger from "./lib/logger";
import prismaClient from "./lib/prisma-client";

import auth from "./middlewares/auth";
import error from "./middlewares/error";
import router from "./routes";
import webhooks from "./routes/webhook.routes";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
    ],
  })
);

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
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: {
      success: false,
      message: "Too many requests. Please try again later.",
    },
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.get("/health", async (req, res) => {
  try {
    // Verify database connectivity
    await prismaClient.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Health check failed - database unreachable", { error });
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use("/api", webhooks);
app.use("/api", auth, router);
app.use(error);

const port = process.env.PORT || 7000;

const server = app.listen(port, () =>
  logger.info(`Server running on http://localhost:${port}`)
);

// Helper to ensure log is written before continuing
function logAndFlush(
  level: "error" | "info" | "warn",
  message: string,
  meta?: object
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

  server.close(async () => {
    try {
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
