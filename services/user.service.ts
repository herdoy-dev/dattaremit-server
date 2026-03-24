import * as Sentry from "@sentry/node";
import AppError from "../lib/AppError";
import prismaClient from "../lib/prisma-client";
import { generateUniqueUserReferCode } from "../lib/refer-code";
import { ensureEmailUnique, ensureEmailUniqueForUpdate } from "../lib/email-validator";
import userRepository from "../repositories/user.repository";
import type { CreateUserInput, UpdateUserInput } from "../schemas/user.schema";

class UserService {
  async getByClerkUserId(clerkUserId: string) {
    return userRepository.findByClerkUserId(clerkUserId);
  }

  async create(data: CreateUserInput) {
    return Sentry.startSpan(
      { name: "user.create", op: "db.transaction", attributes: { "user.has_referral": !!data.referredByCode } },
      async () => {
    const { referredByCode, dateOfBirth, ...rest } = data;

    return prismaClient.$transaction(async (tx) => {
      const existingByClerk = await tx.user.findUnique({
        where: { clerkUserId: data.clerkUserId },
      });

      if (existingByClerk) {
        throw new AppError(409, "Account already exists for this user");
      }

      await ensureEmailUnique(tx, data.email);

      if (referredByCode) {
        const referrer = await tx.user.findUnique({
          where: { referCode: referredByCode.toUpperCase() },
        });
        if (!referrer) {
          throw new AppError(400, "Invalid referral code");
        }
      }

      const referCode = await generateUniqueUserReferCode(tx.user);

      // Prisma extension handles encryption/decryption automatically
      return tx.user.create({
        data: {
          ...rest,
          dateOfBirth: dateOfBirth.toISOString(),
          referCode,
          ...(referredByCode ? { referredByCode } : {}),
        } as Parameters<typeof tx.user.create>[0]["data"],
        include: { addresses: true },
      });
    });
      },
    );
  }

  async update(id: string, data: UpdateUserInput) {
    const { dateOfBirth, ...rest } = data;
    const dataToUpdate: Record<string, unknown> = { ...rest };
    if (dateOfBirth) {
      dataToUpdate.dateOfBirth = dateOfBirth.toISOString();
    }

    return prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: { addresses: true },
      });

      if (!user) {
        throw new AppError(404, "User not found");
      }

      if (data.email) {
        await ensureEmailUniqueForUpdate(tx, data.email, user.emailHash);
      }

      // Prisma extension handles encryption/decryption automatically
      return tx.user.update({
        where: { id },
        data: dataToUpdate as Parameters<typeof tx.user.update>[0]["data"],
        include: { addresses: true },
      });
    });
  }

  async validateReferCode(code: string) {
    const user = await prismaClient.user.findUnique({
      where: { referCode: code },
    });
    return { valid: !!user };
  }

  async getReferralTrackerStats(referCode: string) {
    const referrer = await prismaClient.user.findUnique({
      where: { referCode },
      select: { referCode: true },
    });

    if (!referrer) {
      return {
        referrer: { referCode },
        stats: { totalReferrals: 0 },
      };
    }

    const totalReferrals = await prismaClient.user.count({
      where: { referredByCode: referCode },
    });

    return {
      referrer: {
        referCode: referrer.referCode,
      },
      stats: {
        totalReferrals,
      },
    };
  }

  async requestReferCode(userId: string) {
    return prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new AppError(404, "User not found");
      }

      if (user.referCode) {
        return { referCode: user.referCode };
      }

      const newCode = await generateUniqueUserReferCode(tx.user);
      if (!newCode) {
        throw new AppError(500, "Failed to generate unique refer code");
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { referCode: newCode },
      });
      return { referCode: updated.referCode };
    });
  }
}

export default new UserService();
