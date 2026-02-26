import { Prisma } from "../generated/prisma/client";
import type { AccountStatus, ActivityStatus, ActivityType, UserRole } from "../generated/prisma/client";
import AppError from "../lib/AppError";
import prismaClient, { encryptUserData, decryptUserData, decryptNestedUser } from "../lib/prisma-client";
import crypto from "crypto";
import { createSearchHash } from "../lib/crypto";
import { generateUserReferCode, generatePromoterReferCode } from "../lib/refer-code";
import type { AdminCreateUserInput, AdminCreatePromoterInput, AdminUpdateUserInput } from "../schemas/admin.schema";

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

    const where: Prisma.UserWhereInput = {
      role: { notIn: ["INFLUENCER", "PROMOTER"] },
    };

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
    const { role, accountStatus, referValue, ...dataToEncrypt } = data;
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
        const candidate = generateUserReferCode();
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
          referValue: 1,
        },
        include: { addresses: true },
      });

      return decryptUserData(result);
    });
  }

  async createPromoter(data: AdminCreatePromoterInput) {
    const { role, accountStatus, referValue, ...dataToEncrypt } = data;
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

      // Generate unique promoter refer code: Datta-{FirstName}{LastNameInitial}
      const baseCode = generatePromoterReferCode(data.firstName, data.lastName);
      let referCode = baseCode;
      let suffix = 2;

      // Check for uniqueness, append incrementing number if needed
      while (true) {
        const existing = await tx.user.findUnique({
          where: { referCode },
        });
        if (!existing) break;
        referCode = `${baseCode}${suffix}`;
        suffix++;
      }

      const result = await tx.user.create({
        data: {
          ...(encryptedData as Parameters<typeof tx.user.create>[0]["data"]),
          clerkUserId: `admin_created_${crypto.randomUUID()}`,
          role,
          accountStatus: accountStatus || "ACTIVE",
          referCode,
          referValue,
        },
        include: { addresses: true },
      });

      return decryptUserData(result);
    });
  }

  async previewReferCode(firstName: string, lastName: string) {
    const baseCode = generatePromoterReferCode(firstName, lastName);
    let referCode = baseCode;
    let suffix = 2;

    while (true) {
      const existing = await prismaClient.user.findUnique({
        where: { referCode },
      });
      if (!existing) break;
      referCode = `${baseCode}${suffix}`;
      suffix++;
    }

    return { referCode };
  }

  async getPromoters(
    page: number,
    limit: number,
    search?: string,
    role?: "INFLUENCER" | "PROMOTER"
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: role ? role : { in: ["INFLUENCER", "PROMOTER"] },
    };

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
      }),
      prismaClient.user.count({ where }),
    ]);

    return {
      promoters: users.map(decryptUserData),
      total,
      page,
      limit,
    };
  }

  async getMarketingStats() {
    const [totalInfluencers, totalPromoters, totalPromoterReferrals] =
      await Promise.all([
        prismaClient.user.count({ where: { role: "INFLUENCER" } }),
        prismaClient.user.count({ where: { role: "PROMOTER" } }),
        prismaClient.$queryRaw<{ count: bigint }[]>(
          Prisma.sql`
            SELECT COUNT(r.id) as count
            FROM users r
            INNER JOIN users p ON r."referredByCode" = p."referCode"
            WHERE p.role IN ('INFLUENCER', 'PROMOTER')
          `
        ),
      ]);

    return {
      totalInfluencers,
      totalPromoters,
      totalPromoterReferrals: Number(totalPromoterReferrals[0]?.count ?? 0),
    };
  }

  async updateUser(id: string, data: AdminUpdateUserInput) {
    const { referValue, ...rest } = data;
    const dataToUpdate: Record<string, unknown> = { ...rest };
    if (data.dateOfBirth) {
      dataToUpdate.dateOfBirth = data.dateOfBirth.toISOString();
    }
    const encryptedData = encryptUserData(dataToUpdate);

    // Add referValue back if present (not encrypted)
    if (referValue !== undefined) {
      (encryptedData as Record<string, unknown>).referValue = referValue;
    }

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

  async getReferralStats(page = 1, limit = 20, search?: string) {
    const totalReferrals = await prismaClient.user.count({
      where: { referredByCode: { not: null } },
    });

    const offset = (page - 1) * limit;

    let whereClause = Prisma.sql`WHERE u."referCode" IS NOT NULL`;

    if (search) {
      const searchPattern = `%${search}%`;
      const emailHash = createSearchHash(search);
      whereClause = Prisma.sql`WHERE u."referCode" IS NOT NULL AND (
        u."firstName" ILIKE ${searchPattern} OR
        u."lastName" ILIKE ${searchPattern} OR
        u."referCode" ILIKE ${searchPattern} OR
        u."emailHash" = ${emailHash}
      )`;
    }

    const [topReferrers, countResult] = await Promise.all([
      prismaClient.$queryRaw<
        { id: string; firstName: string; lastName: string; referCode: string; referral_count: bigint }[]
      >(
        Prisma.sql`
          SELECT u.id, u."firstName", u."lastName", u."referCode", COUNT(r.id) as referral_count
          FROM users u
          INNER JOIN users r ON r."referredByCode" = u."referCode"
          ${whereClause}
          GROUP BY u.id, u."firstName", u."lastName", u."referCode"
          ORDER BY referral_count DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      ),
      prismaClient.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`
          SELECT COUNT(*) as count FROM (
            SELECT u.id
            FROM users u
            INNER JOIN users r ON r."referredByCode" = u."referCode"
            ${whereClause}
            GROUP BY u.id
          ) sub
        `
      ),
    ]);

    return {
      totalReferrals,
      topReferrers: topReferrers.map((row) => ({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        referCode: row.referCode,
        referralCount: Number(row.referral_count),
      })),
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
    };
  }
}

export default new AdminService();
