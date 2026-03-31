import { Prisma } from "../generated/prisma/client";
import prismaClient from "../lib/prisma-client";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): T {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

type ChartEntry = { type: string; count: number };
type StatusChartEntry = { status: string; count: number };
type RegistrationChartEntry = { month: string; count: number };

class AdminChartService {
  async getDashboardStats() {
    const cached = getCached<Record<string, unknown>>("dashboardStats");
    if (cached) return cached;

    const [totalUsers, activeUsers, pendingKyc, totalActivities, recentUsers, recentActivities] =
      await Promise.all([
        prismaClient.user.count(),
        prismaClient.user.count({ where: { accountStatus: "ACTIVE" } }),
        prismaClient.user.count({ where: { accountStatus: "PENDING" } }),
        prismaClient.activity.count(),
        prismaClient.user.findMany({
          orderBy: { created_at: "desc" },
          take: 5,
        }),
        prismaClient.activity.findMany({
          orderBy: { created_at: "desc" },
          take: 5,
          include: { user: true },
        }),
      ]);

    return setCache("dashboardStats", {
      totalUsers,
      activeUsers,
      pendingKyc,
      totalActivities,
      recentUsers,
      recentActivities,
    });
  }

  async getRegistrationChart() {
    const cached = getCached<RegistrationChartEntry[]>("registrationChart");
    if (cached) return cached;

    const result = await prismaClient.$queryRaw<
      { month: Date; count: bigint }[]
    >(
      Prisma.sql`SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as count FROM users GROUP BY month ORDER BY month`
    );

    return setCache("registrationChart", result.map((row) => ({
      month: row.month.toISOString(),
      count: Number(row.count),
    })));
  }

  async getActivityTypeChart() {
    const cached = getCached<ChartEntry[]>("activityTypeChart");
    if (cached) return cached;

    const result = await prismaClient.$queryRaw<
      { type: string; count: bigint }[]
    >(
      Prisma.sql`SELECT type, COUNT(*) as count FROM activities GROUP BY type`
    );

    return setCache("activityTypeChart", result.map((row) => ({
      type: row.type,
      count: Number(row.count),
    })));
  }

  async getAccountStatusChart() {
    const cached = getCached<StatusChartEntry[]>("accountStatusChart");
    if (cached) return cached;

    const result = await prismaClient.$queryRaw<
      { accountStatus: string; count: bigint }[]
    >(
      Prisma.sql`SELECT "accountStatus", COUNT(*) as count FROM users GROUP BY "accountStatus"`
    );

    return setCache("accountStatusChart", result.map((row) => ({
      status: row.accountStatus,
      count: Number(row.count),
    })));
  }

  async getKycActivityChart() {
    const cached = getCached<ChartEntry[]>("kycActivityChart");
    if (cached) return cached;

    const result = await prismaClient.$queryRaw<
      { type: string; count: bigint }[]
    >(
      Prisma.sql`SELECT type::text, COUNT(*) as count FROM activities WHERE type::text LIKE 'KYC_%' GROUP BY type`
    );

    return setCache("kycActivityChart", result.map((row) => ({
      type: row.type,
      count: Number(row.count),
    })));
  }
}

export default new AdminChartService();
