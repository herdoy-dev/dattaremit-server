import { Prisma } from "../generated/prisma/client";
import type { AccountStatus, ActivityStatus, ActivityType } from "../generated/prisma/client";
import AppError from "../lib/AppError";
import prismaClient, { decryptUserData, decryptNestedUser } from "../lib/prisma-client";

class AdminService {
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

  async getUsers(
    page: number,
    limit: number,
    search?: string,
    status?: AccountStatus
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (status) {
      where.accountStatus = status;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prismaClient.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: { _count: { select: { addresses: true } } },
      }),
      prismaClient.user.count({ where }),
    ]);

    return {
      users: users.map(decryptUserData),
      total,
      page,
      limit,
    };
  }

  async getUserById(id: string) {
    const user = await prismaClient.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        activities: {
          orderBy: { created_at: "desc" },
          take: 20,
        },
      },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return decryptUserData(user);
  }

  async getActivities(
    page: number,
    limit: number,
    type?: ActivityType,
    status?: ActivityStatus
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    const [activities, total] = await Promise.all([
      prismaClient.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: { user: true },
      }),
      prismaClient.activity.count({ where }),
    ]);

    return {
      activities: activities.map(decryptNestedUser),
      total,
      page,
      limit,
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
      Prisma.sql`SELECT type, COUNT(*) as count FROM activities WHERE type LIKE 'KYC_%' GROUP BY type`
    );

    return result.map((row) => ({
      type: row.type,
      count: Number(row.count),
    }));
  }

  async getReferralStats() {
    const totalReferrals = await prismaClient.user.count({
      where: { referredByCode: { not: null } },
    });

    const topReferrers = await prismaClient.$queryRaw<
      { id: string; firstName: string; lastName: string; referCode: string; referral_count: bigint }[]
    >(
      Prisma.sql`
        SELECT u.id, u."firstName", u."lastName", u."referCode", COUNT(r.id) as referral_count
        FROM users u
        INNER JOIN users r ON r."referredByCode" = u."referCode"
        WHERE u."referCode" IS NOT NULL
        GROUP BY u.id, u."firstName", u."lastName", u."referCode"
        ORDER BY referral_count DESC
        LIMIT 5
      `
    );

    return {
      totalReferrals,
      topReferrers: topReferrers.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        referCode: row.referCode,
        referralCount: Number(row.referral_count),
      })),
    };
  }
}

export default new AdminService();
