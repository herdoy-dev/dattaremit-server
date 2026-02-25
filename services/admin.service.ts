import { Prisma } from "../generated/prisma/client";
import type { AccountStatus, ActivityStatus, ActivityType, UserRole } from "../generated/prisma/client";
import AppError from "../lib/AppError";
import prismaClient, { encryptUserData, decryptUserData, decryptNestedUser } from "../lib/prisma-client";
import crypto from "crypto";
import { createSearchHash } from "../lib/crypto";
import { generateReferCode } from "../lib/refer-code";
import type { AdminCreateUserInput, AdminUpdateUserInput } from "../schemas/admin.schema";

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
      Prisma.sql`SELECT type::text, COUNT(*) as count FROM activities WHERE type::text LIKE 'KYC_%' GROUP BY type`
    );

    return result.map((row) => ({
      type: row.type,
      count: Number(row.count),
    }));
  }

  async createUser(data: AdminCreateUserInput) {
    const { role, accountStatus, ...dataToEncrypt } = data;
    const encryptedData = encryptUserData({
      ...dataToEncrypt,
      dateOfBirth: data.dateOfBirth.toISOString(),
    });

    return prismaClient.$transaction(async (tx) => {
      // Check email uniqueness
      const emailHash = createSearchHash(data.email);
      const existingUser = await tx.user.findUnique({
        where: { emailHash },
      });

      if (existingUser) {
        throw new AppError(409, "User with this email already exists");
      }

      // Generate unique refer code
      let referCode: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = generateReferCode();
        const existing = await tx.user.findUnique({
          where: { referCode: candidate },
        });
        if (!existing) {
          referCode = candidate;
          break;
        }
      }

      const result = await tx.user.create({
        data: {
          ...(encryptedData as Parameters<typeof tx.user.create>[0]["data"]),
          clerkUserId: `admin_created_${crypto.randomUUID()}`,
          role: role || "USER",
          accountStatus: accountStatus || "INITIAL",
          referCode,
        },
        include: { addresses: true },
      });

      return decryptUserData(result);
    });
  }

  async updateUser(id: string, data: AdminUpdateUserInput) {
    const dataToUpdate: Record<string, unknown> = { ...data };
    if (data.dateOfBirth) {
      dataToUpdate.dateOfBirth = data.dateOfBirth.toISOString();
    }
    const encryptedData = encryptUserData(dataToUpdate);

    return prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });

      if (!user) {
        throw new AppError(404, "User not found");
      }

      // Check email uniqueness if email is being updated
      if (data.email) {
        const newEmailHash = createSearchHash(data.email);
        if (newEmailHash !== user.emailHash) {
          const existingUser = await tx.user.findUnique({
            where: { emailHash: newEmailHash },
          });
          if (existingUser) {
            throw new AppError(409, "User with this email already exists");
          }
        }
      }

      const result = await tx.user.update({
        where: { id },
        data: encryptedData as Parameters<typeof tx.user.update>[0]["data"],
        include: { addresses: true },
      });

      return decryptUserData(result);
    });
  }

  async deleteUser(id: string) {
    const user = await prismaClient.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    await prismaClient.user.delete({ where: { id } });
  }

  async changeUserRole(id: string, role: UserRole) {
    const user = await prismaClient.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    const result = await prismaClient.user.update({
      where: { id },
      data: { role },
    });

    return decryptUserData(result);
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
