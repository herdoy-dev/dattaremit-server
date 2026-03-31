import * as Sentry from "@sentry/node";
import { Prisma, ActivityStatus, ActivityType } from "../generated/prisma/client";
import type { AccountStatus, UserRole } from "../generated/prisma/client";
import AppError from "../lib/AppError";
import prismaClient from "../lib/prisma-client";
import crypto from "crypto";
import { generateUniqueUserReferCode } from "../lib/refer-code";
import { ensureEmailUnique, ensureEmailUniqueForUpdate } from "../lib/email-validator";
import type { AdminCreateUserInput, AdminUpdateUserInput } from "../schemas/admin.schema";
import activityLogger from "../lib/activity-logger";


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

class AdminService {
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
      users,
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

    return user;
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
      activities,
      total,
      page,
      limit,
    };
  }

  async createUser(data: AdminCreateUserInput, actingAdminId?: string) {
    return Sentry.startSpan(
      { name: "admin.createUser", op: "db.transaction", attributes: { "admin.role": data.role || "USER" } },
      async () => {
    const { role, accountStatus, referValue, dateOfBirth, ...rest } = data;

    return prismaClient.$transaction(async (tx) => {
      await ensureEmailUnique(tx, data.email);

      const referCode = await generateUniqueUserReferCode(tx.user);

      // Prisma extension handles encryption/decryption automatically
      const result = await tx.user.create({
        data: {
          ...rest,
          ...(dateOfBirth ? { dateOfBirth: dateOfBirth.toISOString() } : {}),
          clerkUserId: `admin_created_${crypto.randomUUID()}`,
          role: role || "USER",
          accountStatus: accountStatus || "INITIAL",
          referCode,
          referValue: 1,
        } as Parameters<typeof tx.user.create>[0]["data"],
        include: { addresses: true },
      });

      await logAdminAction(actingAdminId, `Admin created user ${result.id}`, {
        action: "createUser",
        targetUserId: result.id,
      });

      return result;
    });
      },
    );
  }

  async updateUser(id: string, data: AdminUpdateUserInput, actingAdminId?: string) {
    return Sentry.startSpan(
      { name: "admin.updateUser", op: "db.transaction", attributes: { "admin.target_user": id } },
      async () => {
    const { referValue, dateOfBirth, ...rest } = data;
    const dataToUpdate: Record<string, unknown> = { ...rest };

    if (dateOfBirth) {
      dataToUpdate.dateOfBirth = dateOfBirth.toISOString();
    }

    // Add referValue back if present (not encrypted)
    if (referValue !== undefined) {
      dataToUpdate.referValue = referValue;
    }

    return prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });

      if (!user) {
        throw new AppError(404, "User not found");
      }

      if (data.email) {
        await ensureEmailUniqueForUpdate(tx, data.email, user.email);
      }

      // Prisma extension handles encryption/decryption automatically
      const result = await tx.user.update({
        where: { id },
        data: dataToUpdate as Parameters<typeof tx.user.update>[0]["data"],
        include: { addresses: true },
      });

      await logAdminAction(actingAdminId, `Admin updated user ${id}`, {
        action: "updateUser",
        targetUserId: id,
        updatedFields: Object.keys(data),
      });

      return result;
    });
      },
    );
  }

  async deleteUser(id: string, actingAdminId: string) {
    return Sentry.startSpan(
      { name: "admin.deleteUser", op: "db.transaction", attributes: { "admin.target_user": id } },
      async () => {
    if (id === actingAdminId) {
      throw new AppError(400, "Cannot delete your own account");
    }

    const user = await prismaClient.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.role === "ADMIN") {
      const adminCount = await prismaClient.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw new AppError(400, "Cannot delete the last admin account");
      }
    }

    const anonymizedEmail = `deleted_${crypto.createHash("sha256").update(id).digest("hex")}@deleted.invalid`;

    // Prisma extension handles encryption automatically
    await prismaClient.user.update({
      where: { id },
      data: {
        firstName: "DELETED",
        lastName: "DELETED",
        email: anonymizedEmail,
        phoneNumber: "0000000000",
        phoneNumberPrefix: "",
        accountStatus: "DELETED" as AccountStatus,
        clerkUserId: `deleted_${id}`,
      },
    });

    await logAdminAction(actingAdminId, `Admin soft-deleted user ${id}`, {
      action: "deleteUser",
      targetUserId: id,
    });
      },
    );
  }

  async changeUserRole(id: string, role: UserRole, actingAdminId: string) {
    if (id === actingAdminId) {
      throw new AppError(400, "Cannot change your own role");
    }

    const user = await prismaClient.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError(404, "User not found");
    }

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

    return result;
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

    return result;
  }
}

export default new AdminService();
