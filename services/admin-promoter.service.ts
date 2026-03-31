import { Prisma, ActivityStatus, ActivityType } from "../generated/prisma/client";
import AppError from "../lib/AppError";
import prismaClient from "../lib/prisma-client";
import crypto from "crypto";
import { generateUniquePromoterReferCode } from "../lib/refer-code";
import { ensureEmailUnique } from "../lib/email-validator";
import type { AdminCreatePromoterInput } from "../schemas/admin.schema";
import activityLogger from "../lib/activity-logger";

function escapeIlike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

class AdminPromoterService {
  async createPromoter(data: AdminCreatePromoterInput, actingAdminId?: string) {
    const { role, accountStatus, referValue, dateOfBirth, ...rest } = data;

    return prismaClient.$transaction(async (tx) => {
      await ensureEmailUnique(tx, data.email);

      const referCode = await generateUniquePromoterReferCode(
        tx.user,
        data.firstName,
        data.lastName,
      );

      // Prisma extension handles encryption/decryption automatically
      const result = await tx.user.create({
        data: {
          ...rest,
          ...(dateOfBirth ? { dateOfBirth: dateOfBirth.toISOString() } : {}),
          clerkUserId: `admin_created_${crypto.randomUUID()}`,
          role,
          accountStatus: accountStatus || "ACTIVE",
          referCode,
          referValue,
        } as Parameters<typeof tx.user.create>[0]["data"],
        include: { addresses: true },
      });

      if (actingAdminId) {
        await activityLogger.logActivity({
          userId: actingAdminId,
          type: ActivityType.ADMIN_ACTION,
          status: ActivityStatus.COMPLETE,
          description: `Admin created promoter ${result.id}`,
          metadata: { action: "createPromoter", targetUserId: result.id, role },
        });
      }

      return result;
    });
  }

  async previewReferCode(firstName: string, lastName: string) {
    const referCode = await generateUniquePromoterReferCode(
      prismaClient.user,
      firstName,
      lastName,
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
      promoters: users,
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

  async getReferralStats(page = 1, limit = 20, search?: string) {
    const totalReferrals = await prismaClient.user.count({
      where: { referredByCode: { not: null } },
    });

    const offset = (page - 1) * limit;

    let whereClause = Prisma.sql`WHERE u."referCode" IS NOT NULL`;

    if (search) {
      const searchPattern = `%${escapeIlike(search)}%`;
      whereClause = Prisma.sql`WHERE u."referCode" IS NOT NULL AND (
        u."firstName" ILIKE ${searchPattern} OR
        u."lastName" ILIKE ${searchPattern} OR
        u."referCode" ILIKE ${searchPattern} OR
        u."email" ILIKE ${searchPattern}
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

export default new AdminPromoterService();
