import AppError from "../lib/AppError";
import prismaClient, {
  encryptUserData,
  decryptUserData,
} from "../lib/prisma-client";
import { createSearchHash } from "../lib/crypto";
import userRepository from "../repositories/user.repository";
import type { CreateUserInput, UpdateUserInput } from "../schemas/user.schema";

class UserService {
  async getByClerkUserId(clerkUserId: string) {
    const user = await userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    return user;
  }

  async create(data: CreateUserInput) {
    // Encrypt data and prepare for database
    const encryptedData = encryptUserData({
      ...data,
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

      const result = await tx.user.create({
        data: encryptedData as Parameters<typeof tx.user.create>[0]["data"],
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
}

export default new UserService();
