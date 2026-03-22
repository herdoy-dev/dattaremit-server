import { Prisma } from "../generated/prisma/client";
import prismaClient, { decryptUserData, decryptNestedUser } from "../lib/prisma-client";

class AdminChartService {
  async getDashboardStats() {
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

    return {
      totalUsers,
      activeUsers,
      pendingKyc,
      totalActivities,
      recentUsers: recentUsers.map(decryptUserData),
      recentActivities: recentActivities.map(decryptNestedUser),
    };
  }

  async getRegistrationChart() {
    const result = await prismaClient.$queryRaw<
      { month: Date; count: bigint }[]
    >(
      Prisma.sql`SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as count FROM users GROUP BY month ORDER BY month`
    );

    return result.map((row) => ({
      month: row.month.toISOString(),
      count: Number(row.count),
    }));
  }

  async getActivityTypeChart() {
    const result = await prismaClient.$queryRaw<
      { type: string; count: bigint }[]
    >(
      Prisma.sql`SELECT type, COUNT(*) as count FROM activities GROUP BY type`
    );

    return result.map((row) => ({
      type: row.type,
      count: Number(row.count),
    }));
  }

  async getAccountStatusChart() {
    const result = await prismaClient.$queryRaw<
      { accountStatus: string; count: bigint }[]
    >(
      Prisma.sql`SELECT "accountStatus", COUNT(*) as count FROM users GROUP BY "accountStatus"`
    );

    return result.map((row) => ({
      status: row.accountStatus,
      count: Number(row.count),
    }));
  }

  async getKycActivityChart() {
    const result = await prismaClient.$queryRaw<
      { type: string; count: bigint }[]
    >(
      Prisma.sql`SELECT type::text, COUNT(*) as count FROM activities WHERE type::text LIKE 'KYC_%' GROUP BY type`
    );

    return result.map((row) => ({
      type: row.type,
      count: Number(row.count),
    }));
  }
}

export default new AdminChartService();
