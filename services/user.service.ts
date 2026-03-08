import AppError from "../lib/AppError";
import prismaClient, {
  encryptUserData,
  decryptUserData,
} from "../lib/prisma-client";
import { createSearchHash } from "../lib/crypto";
import { generateUserReferCode } from "../lib/refer-code";
import userRepository from "../repositories/user.repository";
import type { CreateUserInput, UpdateUserInput } from "../schemas/user.schema";

class UserService {
  async getByClerkUserId(clerkUserId: string) {
    return userRepository.findByClerkUserId(clerkUserId);
  }

  async create(data: CreateUserInput) {
    // Encrypt data and prepare for database (exclude referredByCode from encryption)
    const { referredByCode, ...dataToEncrypt } = data;
    const encryptedData = encryptUserData({
      ...dataToEncrypt,
      dateOfBirth: data.dateOfBirth.toISOString(),
    });

    return prismaClient.$transaction(async (tx) => {
      // Check for existing user by clerkUserId
      const existingByClerk = await tx.user.findUnique({
        where: { clerkUserId: data.clerkUserId },
      });

      if (existingByClerk) {
        throw new AppError(409, "Account already exists for this user");
      }

      // Check for existing user using emailHash
      const emailHash = createSearchHash(data.email);
      const existingUser = await tx.user.findUnique({
        where: { emailHash },
      });

      if (existingUser) {
        throw new AppError(409, "User with this email already exists");
      }

      // Validate referredByCode if provided
      if (referredByCode) {
        const referrer = await tx.user.findUnique({
          where: { referCode: referredByCode.toUpperCase() },
        });
        if (!referrer) {
          throw new AppError(400, "Invalid referral code");
        }
      }

      // Generate a unique refer code with retry
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
          referCode,
          ...(referredByCode ? { referredByCode } : {}),
        },
        include: { addresses: true },
      });

      return decryptUserData(result);
    });
  }

  async update(id: string, data: UpdateUserInput) {
    // Prepare encrypted data if there are fields to encrypt
    const dataToUpdate: Record<string, unknown> = { ...data };
    if (data.dateOfBirth) {
      dataToUpdate.dateOfBirth = data.dateOfBirth.toISOString();
    }
    const encryptedData = encryptUserData(dataToUpdate);

    return prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: { addresses: true },
      });

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

      // Idempotent: return existing code
      if (user.referCode) {
        return { referCode: user.referCode };
      }

      // Generate a unique refer code with retry
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = generateUserReferCode();
        const existing = await tx.user.findUnique({
          where: { referCode: candidate },
        });
        if (!existing) {
          const updated = await tx.user.update({
            where: { id: userId },
            data: { referCode: candidate },
          });
          return { referCode: updated.referCode };
        }
      }

      throw new AppError(500, "Failed to generate unique refer code");
    });
  }
}

export default new UserService();
