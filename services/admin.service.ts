import { Prisma, ActivityStatus, ActivityType } from "../generated/prisma/client";
import type { AccountStatus, UserRole } from "../generated/prisma/client";
import AppError from "../lib/AppError";
import prismaClient, { encryptUserData, decryptUserData, decryptNestedUser } from "../lib/prisma-client";
import crypto from "crypto";
import { createSearchHash } from "../lib/crypto";
import { generateUserReferCode, generatePromoterReferCode } from "../lib/refer-code";
import type { AdminCreateUserInput, AdminCreatePromoterInput, AdminUpdateUserInput } from "../schemas/admin.schema";
import activityLogger from "../lib/activity-logger";

/**
 * Escapes special ILIKE/LIKE wildcard characters (%, _, \) in a search string
 * to prevent users from injecting wildcard patterns.
 */
function escapeIlike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function logAdminAction(
  actingAdminId: string | undefined,
  description: string,
  metadata: Record<string, unknown>
) {
  if (actingAdminId) {
    await activityLogger.logActivity({
      userId: actingAdminId,
      type: ActivityType.ADMIN_ACTION,
      status: ActivityStatus.COMPLETE,
      description,
      metadata,
    });
  }
}

async function ensureEmailUnique(
  tx: { user: { findUnique: Function } },
  email: string
) {
  const emailHash = createSearchHash(email);
  const existingUser = await tx.user.findUnique({
    where: { emailHash },
  });

  if (existingUser) {
    throw new AppError(409, "User with this email already exists");
  }
}

function prepareEncryptedUserData(data: { dateOfBirth?: Date; [key: string]: unknown }) {
  const { dateOfBirth, ...rest } = data;
  return encryptUserData({
    ...rest,
    ...(dateOfBirth ? { dateOfBirth: dateOfBirth.toISOString() } : {}),
  });
}

async function generateUniquePromoterCode(
  lookup: { findUnique: Function },
  firstName: string,
  lastName: string
) {
  const baseCode = generatePromoterReferCode(firstName, lastName);
  let referCode = baseCode;
  let suffix = 2;

  const MAX_CODE_ATTEMPTS = 100;
  while (suffix <= MAX_CODE_ATTEMPTS + 1) {
    const existing = await lookup.findUnique({
      where: { referCode },
    });
    if (!existing) return referCode;
    referCode = `${baseCode}${suffix}`;
    suffix++;
    if (suffix > MAX_CODE_ATTEMPTS + 1) {
      throw new AppError(500, "Failed to generate unique promoter refer code");
    }
  }

  return referCode;
}

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
      const sanitized = escapeIlike(search);
      where.OR = [
        { firstName: { contains: sanitized, mode: "insensitive" } },
        { lastName: { contains: sanitized, mode: "insensitive" } },
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

  async createUser(data: AdminCreateUserInput, actingAdminId?: string) {
    const { role, accountStatus, referValue, ...dataToEncrypt } = data;
    const encryptedData = prepareEncryptedUserData(dataToEncrypt);

    return prismaClient.$transaction(async (tx) => {
      await ensureEmailUnique(tx, data.email);

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

      await logAdminAction(actingAdminId, `Admin created user ${result.id}`, {
        action: "createUser",
        targetUserId: result.id,
      });

      return decryptUserData(result);
    });
  }

  async createPromoter(data: AdminCreatePromoterInput, actingAdminId?: string) {
    const { role, accountStatus, referValue, ...dataToEncrypt } = data;
    const encryptedData = prepareEncryptedUserData(dataToEncrypt);

    return prismaClient.$transaction(async (tx) => {
      await ensureEmailUnique(tx, data.email);

      const referCode = await generateUniquePromoterCode(
        tx.user,
        data.firstName,
        data.lastName
      );

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

      await logAdminAction(actingAdminId, `Admin created promoter ${result.id}`, {
        action: "createPromoter",
        targetUserId: result.id,
        role,
      });

      return decryptUserData(result);
    });
  }

  async previewReferCode(firstName: string, lastName: string) {
    const referCode = await generateUniquePromoterCode(
      prismaClient.user,
      firstName,
      lastName
    );

    return { referCode };
  }

  async getPromoters(
    page: number,
    limit: number,
    search?: string,
    role?: string
  ) {
    if (role && role !== "INFLUENCER" && role !== "PROMOTER") {
      throw new AppError(400, "Invalid role filter");
    }

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: role ? (role as "INFLUENCER" | "PROMOTER") : { in: ["INFLUENCER", "PROMOTER"] as const },
    };

    if (search) {
      const sanitized = escapeIlike(search);
      where.OR = [
        { firstName: { contains: sanitized, mode: "insensitive" } },
        { lastName: { contains: sanitized, mode: "insensitive" } },
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

  async updateUser(id: string, data: AdminUpdateUserInput, actingAdminId?: string) {
    const { referValue, ...rest } = data;
    const encryptedData = prepareEncryptedUserData(rest);

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

      await logAdminAction(actingAdminId, `Admin updated user ${id}`, {
        action: "updateUser",
        targetUserId: id,
        updatedFields: Object.keys(data),
      });

      return decryptUserData(result);
    });
  }

  async deleteUser(id: string, actingAdminId: string) {
    if (id === actingAdminId) {
      throw new AppError(400, "Cannot delete your own account");
    }

    const user = await prismaClient.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    // Prevent deleting the last admin
    if (user.role === "ADMIN") {
      const adminCount = await prismaClient.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw new AppError(400, "Cannot delete the last admin account");
      }
    }

    // Soft-delete: anonymize PII and set status to DELETED.
    // Activity records are preserved for audit trail.
    const anonymizedEmail = `deleted_${crypto.createHash("sha256").update(id).digest("hex")}@deleted.invalid`;
    const anonymizedData = encryptUserData({
      firstName: "DELETED",
      lastName: "DELETED",
      email: anonymizedEmail,
      phone: "0000000000",
    });

    await prismaClient.user.update({
      where: { id },
      data: {
        ...(anonymizedData as Parameters<typeof prismaClient.user.update>[0]["data"]),
        accountStatus: "DELETED" as AccountStatus,
        clerkUserId: `deleted_${id}`,
      },
    });

    await logAdminAction(actingAdminId, `Admin soft-deleted user ${id}`, {
      action: "deleteUser",
      targetUserId: id,
    });
  }

  async changeUserRole(id: string, role: UserRole, actingAdminId: string) {
    if (id === actingAdminId) {
      throw new AppError(400, "Cannot change your own role");
    }

    const user = await prismaClient.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    // Prevent removing the last admin
    if (user.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await prismaClient.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw new AppError(400, "Cannot demote the last admin");
      }
    }

    const result = await prismaClient.user.update({
      where: { id },
      data: { role },
    });

    await logAdminAction(actingAdminId, `Admin changed role of user ${id} to ${role}`, {
      action: "changeUserRole",
      targetUserId: id,
      previousRole: user.role,
      newRole: role,
    });

    return decryptUserData(result);
  }

  async toggleAchPush(id: string, enabled: boolean, actingAdminId?: string) {
    const user = await prismaClient.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    const result = await prismaClient.user.update({
      where: { id },
      data: { achPushEnabled: enabled },
    });

    await logAdminAction(actingAdminId, `Admin ${enabled ? "enabled" : "disabled"} ACH push for user ${id}`, {
      action: "toggleAchPush",
      targetUserId: id,
      enabled,
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
      const searchPattern = `%${escapeIlike(search)}%`;
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
