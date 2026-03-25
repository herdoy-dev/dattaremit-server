import dotenv from "dotenv";
import axios from "axios";
import pg from "pg";
import net from "net";
import { execSync } from "child_process";

dotenv.config();

// ── ANSI Colors ──────────────────────────────────────────────
const PASS = "\x1b[32m[PASS]\x1b[0m";
const FAIL = "\x1b[31m[FAIL]\x1b[0m";
const WARN = "\x1b[33m[WARN]\x1b[0m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// ── Types ────────────────────────────────────────────────────
type Status = "pass" | "fail" | "warn";
interface CheckResult {
  name: string;
  status: Status;
  message: string;
}

// ── Utilities ────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function statusLabel(s: Status): string {
  if (s === "pass") return PASS;
  if (s === "fail") return FAIL;
  return WARN;
}

function printResult(r: CheckResult): void {
  const label = statusLabel(r.status);
  console.log(`  ${label} ${r.name.padEnd(24)} ${r.message}`);
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: "127.0.0.1" });
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => resolve(false));
    sock.setTimeout(2000, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

// ── Required env vars (mirrors index.ts) ─────────────────────
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
];

const OPTIONAL_ENV_VARS = [
  "SENTRY_DSN",
  "EXPO_ACCESS_TOKEN",
  "PORT",
  "NODE_ENV",
];

// ── Check 1: Environment Variables ───────────────────────────
async function checkEnvVars(): Promise<CheckResult> {
  const missingRequired = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  const missingOptional = OPTIONAL_ENV_VARS.filter((v) => !process.env[v]);

  if (missingRequired.length > 0) {
    return {
      name: "Environment Variables",
      status: "fail",
      message: `Missing required: ${missingRequired.join(", ")}`,
    };
  }

  // Validate ENCRYPTION_KEY format
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY!)) {
    return {
      name: "Environment Variables",
      status: "fail",
      message: "ENCRYPTION_KEY must be exactly 64 hex characters",
    };
  }

  if (missingOptional.length > 0) {
    return {
      name: "Environment Variables",
      status: "warn",
      message: `All required present. Optional missing: ${missingOptional.join(", ")}`,
    };
  }

  return {
    name: "Environment Variables",
    status: "pass",
    message: `All ${REQUIRED_ENV_VARS.length} required vars present`,
  };
}

// ── Check 2: Server Process ──────────────────────────────────
async function checkServerProcess(): Promise<CheckResult> {
  const port = parseInt(process.env.PORT || "5000", 10);
  const listening = await checkPort(port);

  if (!listening) {
    return {
      name: "Server Process",
      status: "warn",
      message: `Nothing listening on port ${port}`,
    };
  }

  return {
    name: "Server Process",
    status: "pass",
    message: `Listening on port ${port}`,
  };
}

// ── Check 3: API Health ──────────────────────────────────────
async function checkApiHealth(): Promise<CheckResult> {
  const port = process.env.PORT || "5000";
  try {
    const res = await axios.get(`http://127.0.0.1:${port}/health`, {
      timeout: 5000,
    });
    if (res.status === 200) {
      return {
        name: "API Health",
        status: "pass",
        message: "GET /health returned 200",
      };
    }
    return {
      name: "API Health",
      status: "fail",
      message: `GET /health returned ${res.status}`,
    };
  } catch (err: any) {
    if (err.code === "ECONNREFUSED") {
      return {
        name: "API Health",
        status: "warn",
        message: "Server not running — skipped",
      };
    }
    return {
      name: "API Health",
      status: "fail",
      message: err.message || "Request failed",
    };
  }
}

// ── Check 4: Database ────────────────────────────────────────
async function checkDatabase(): Promise<CheckResult> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return {
      name: "Database",
      status: "fail",
      message: "DATABASE_URL not set",
    };
  }

  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const versionResult = await client.query("SELECT version()");
    const version = (versionResult.rows[0].version as string).split(",")[0];

    const connResult = await client.query(
      "SELECT count(*)::int AS active FROM pg_stat_activity WHERE datname = current_database()",
    );
    const active = connResult.rows[0].active;

    return {
      name: "Database",
      status: "pass",
      message: `${version}, ${active} active connections`,
    };
  } catch (err: any) {
    return {
      name: "Database",
      status: "fail",
      message: err.message?.replace(/password=\S+/g, "password=***") || "Connection failed",
    };
  } finally {
    await client.end().catch(() => {});
  }
}

// ── Check 5: Clerk Auth ──────────────────────────────────────
async function checkClerk(): Promise<CheckResult> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) {
    return { name: "Clerk Auth", status: "fail", message: "CLERK_SECRET_KEY not set" };
  }

  try {
    const res = await axios.get("https://api.clerk.com/v1/jwks", {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 5000,
    });
    if (res.status === 200) {
      return { name: "Clerk Auth", status: "pass", message: "JWKS endpoint reachable" };
    }
    return { name: "Clerk Auth", status: "fail", message: `HTTP ${res.status}` };
  } catch (err: any) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      return { name: "Clerk Auth", status: "fail", message: "Invalid secret key" };
    }
    return { name: "Clerk Auth", status: "fail", message: err.message || "Unreachable" };
  }
}

// ── Check 6: Zynk API ────────────────────────────────────────
async function checkZynk(): Promise<CheckResult> {
  const baseUrl = process.env.ZYNK_API_BASE_URL;
  const token = process.env.ZYNK_API_TOKEN;
  if (!baseUrl || !token) {
    return { name: "Zynk API", status: "fail", message: "ZYNK_API_BASE_URL or ZYNK_API_TOKEN not set" };
  }

  try {
    const res = await axios.get(baseUrl, {
      headers: { "x-api-token": token },
      timeout: 5000,
      validateStatus: () => true, // any HTTP response = reachable
    });
    return {
      name: "Zynk API",
      status: "pass",
      message: `Reachable (HTTP ${res.status})`,
    };
  } catch (err: any) {
    return { name: "Zynk API", status: "fail", message: err.message || "Unreachable" };
  }
}

// ── Check 7: Google Maps ─────────────────────────────────────
async function checkGoogleMaps(): Promise<CheckResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return { name: "Google Maps", status: "fail", message: "GOOGLE_MAPS_API_KEY not set" };
  }

  try {
    const res = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${key}`,
      { timeout: 5000 },
    );
    const status = res.data?.status;
    if (status === "OK" || status === "ZERO_RESULTS") {
      return { name: "Google Maps", status: "pass", message: "API key valid" };
    }
    if (status === "REQUEST_DENIED") {
      return { name: "Google Maps", status: "fail", message: "API key invalid or restricted" };
    }
    return { name: "Google Maps", status: "warn", message: `API status: ${status}` };
  } catch (err: any) {
    return { name: "Google Maps", status: "fail", message: err.message || "Unreachable" };
  }
}

// ── Check 8: Resend Email ────────────────────────────────────
async function checkResend(): Promise<CheckResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { name: "Resend Email", status: "fail", message: "RESEND_API_KEY not set" };
  }

  try {
    const res = await axios.get("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 5000,
    });
    if (res.status === 200) {
      return { name: "Resend Email", status: "pass", message: "API reachable" };
    }
    return { name: "Resend Email", status: "fail", message: `HTTP ${res.status}` };
  } catch (err: any) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      return { name: "Resend Email", status: "fail", message: "Invalid API key" };
    }
    return { name: "Resend Email", status: "fail", message: err.message || "Unreachable" };
  }
}

// ── Check 9: Exchange Rate API ───────────────────────────────
async function checkExchangeRate(): Promise<CheckResult> {
  try {
    const res = await axios.get("https://open.er-api.com/v6/latest/USD", {
      timeout: 5000,
    });
    if (res.data?.result === "success") {
      const inr = res.data.rates?.INR;
      return {
        name: "Exchange Rate API",
        status: "pass",
        message: inr ? `USD/INR rate: ${inr}` : "API reachable",
      };
    }
    return { name: "Exchange Rate API", status: "fail", message: "Unexpected response" };
  } catch (err: any) {
    return { name: "Exchange Rate API", status: "fail", message: err.message || "Unreachable" };
  }
}

// ── Check 10: Prisma Migrations ──────────────────────────────
async function checkMigrations(): Promise<CheckResult> {
  try {
    const output = execSync("bunx prisma migrate status 2>&1", {
      timeout: 15000,
      encoding: "utf-8",
      cwd: process.cwd(),
    });

    if (output.includes("Database schema is up to date")) {
      return { name: "Migrations", status: "pass", message: "Schema up to date" };
    }
    if (output.includes("have not yet been applied")) {
      const match = output.match(/Following (\d+) migration/);
      const count = match?.[1] || "some";
      return { name: "Migrations", status: "fail", message: `${count} pending migration(s)` };
    }
    return { name: "Migrations", status: "warn", message: "Could not determine status" };
  } catch (err: any) {
    const msg = err.stderr?.toString() || err.message || "Command failed";
    return {
      name: "Migrations",
      status: "fail",
      message: msg.replace(/password=\S+/g, "password=***").slice(0, 100),
    };
  }
}

// ── Check 11: Sentry DSN ────────────────────────────────────
async function checkSentryDsn(): Promise<CheckResult> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return { name: "Sentry DSN", status: "warn", message: "Not configured" };
  }

  // Basic DSN format: https://<key>@<host>/<project-id>
  const dsnPattern = /^https:\/\/.+@.+\/\d+$/;
  if (dsnPattern.test(dsn)) {
    return { name: "Sentry DSN", status: "pass", message: "Valid format" };
  }
  return { name: "Sentry DSN", status: "fail", message: "Malformed DSN" };
}

// ── Check 12: Disk Space ─────────────────────────────────────
async function checkDiskSpace(): Promise<CheckResult> {
  try {
    const output = execSync("df -h . | tail -1", {
      timeout: 5000,
      encoding: "utf-8",
    });
    const parts = output.trim().split(/\s+/);
    const available = parts[3] || "unknown";
    const usePercent = parts[4] || "unknown";

    // Parse available space
    const availNum = parseFloat(available);
    const unit = available.replace(/[0-9.]/g, "").toUpperCase();
    const isLow =
      (unit === "M" && availNum < 1000) ||
      (unit === "K") ||
      (unit === "B");

    if (isLow) {
      return {
        name: "Disk Space",
        status: "warn",
        message: `Low disk: ${available} available (${usePercent} used)`,
      };
    }
    return {
      name: "Disk Space",
      status: "pass",
      message: `${available} available (${usePercent} used)`,
    };
  } catch (err: any) {
    return { name: "Disk Space", status: "warn", message: "Could not determine disk space" };
  }
}

// ── Main ─────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`\n  ${BOLD}Dattaremit Server Troubleshoot${RESET}\n`);
  console.log("=".repeat(60));

  const checks = [
    checkEnvVars,
    checkServerProcess,
    checkApiHealth,
    checkDatabase,
    checkClerk,
    checkZynk,
    checkMigrations,
    checkGoogleMaps,
    checkResend,
    checkExchangeRate,
    checkSentryDsn,
    checkDiskSpace,
  ];

  const results: CheckResult[] = [];

  for (const check of checks) {
    try {
      const result = await withTimeout(check(), 15000);
      results.push(result);
      printResult(result);
    } catch (err: any) {
      const result: CheckResult = {
        name: check.name.replace("check", ""),
        status: "fail",
        message: `Timed out — ${err.message}`,
      };
      results.push(result);
      printResult(result);
    }
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warned = results.filter((r) => r.status === "warn").length;

  console.log("\n" + "=".repeat(60));
  console.log(
    `  Summary: ${BOLD}${passed} passed${RESET}, ${warned} warnings, ${failed} failed\n`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

main();
