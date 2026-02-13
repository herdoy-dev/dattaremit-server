import { ActivityStatus, ActivityType } from "../generated/prisma/client";
import activityLogger from "../lib/activity-logger";
import AppError from "../lib/AppError";
import prismaClient, { decryptUserData } from "../lib/prisma-client";
import addressRepository from "../repositories/address.repository";
import userRepository from "../repositories/user.repository";
import type { ZynkEntityData } from "../repositories/zynk.repository";
import zynkRepository from "../repositories/zynk.repository";

class ZynkService {
  async createEntity(userId: string) {
    // Initial validation
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    const addresses = await addressRepository.findAllByUserId(userId);
    // Prefer PERMANENT address for KYC, fall back to PRESENT
    const address =
      addresses.find((a: { type?: string }) => a.type === "PERMANENT") ||
      addresses[0];

    if (!address) {
      throw new AppError(
        400,
        "User must have an address to create a Zynk entity"
      );
    }

    // dateOfBirth is now a decrypted ISO string, extract just the date part
    const dateOfBirth = user.dateOfBirth.split("T")[0] as string;

    const entityData: ZynkEntityData = {
      type: "individual",
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumberPrefix: user.phoneNumberPrefix.replace("+", ""),
      phoneNumber: user.phoneNumber,
      dateOfBirth,
      permanentAddress: {
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || undefined,
        city: address.city,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode,
      },
    };

    // Call external API first (cannot be rolled back)
    const response = await zynkRepository.createEntity(entityData);

    // Wrap check + update in transaction to prevent race conditions
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        include: { addresses: true },
      });

      if (!currentUser) {
        throw new AppError(404, "User not found");
      }

      if (currentUser.zynkEntityId) {
        throw new AppError(409, "User already has a Zynk entity");
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          zynkEntityId: response.data.entityId,
          accountStatus: "PENDING",
        },
        include: { addresses: true },
      });
    });

    return decryptUserData(updatedUser);
  }

  async startKyc(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(
        400,
        "User does not have a Zynk entity. Create entity first."
      );
    }

    const response = await zynkRepository.startKyc(user.zynkEntityId);

    await activityLogger.logActivity({
      userId,
      type: ActivityType.KYC_PENDING,
      status: ActivityStatus.PENDING,
      description: "KYC started",
      metadata: { entityId: user.zynkEntityId },
    });

    return response.data;
  }

  async getKycStatus(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(
        400,
        "User does not have a Zynk entity. Create entity first."
      );
    }

    const response = await zynkRepository.getKycStatus(user.zynkEntityId);

    return response.data;
  }

  async createFundingAccount(userId: string) {
    // Initial validation
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(
        400,
        "User does not have a Zynk entity. Create entity first."
      );
    }

    // Call external API first (cannot be rolled back)
    const response = await zynkRepository.createFundingAccount(
      user.zynkEntityId
    );

    // Wrap check + update in transaction to prevent race conditions
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        include: { addresses: true },
      });

      if (!currentUser) {
        throw new AppError(404, "User not found");
      }

      if (currentUser.zynkFundingAccountId) {
        throw new AppError(409, "User already has a funding account");
      }

      return tx.user.update({
        where: { id: userId },
        data: { zynkFundingAccountId: response.data.data.id },
        include: { addresses: true },
      });
    });

    await activityLogger.logActivity({
      userId,
      type: ActivityType.ACCOUNT_APPROVED,
      status: ActivityStatus.COMPLETE,
      description: "Funding account created",
      metadata: { fundingAccountId: response.data.data.id },
    });

    return {
      user: decryptUserData(updatedUser),
      fundingAccount: response.data.data,
    };
  }

  async getFundingAccount(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(
        400,
        "User does not have a Zynk entity. Create entity first."
      );
    }

    if (!user.zynkFundingAccountId) {
      throw new AppError(
        400,
        "User does not have a funding account. Create funding account first."
      );
    }

    const response = await zynkRepository.getFundingAccount(
      user.zynkEntityId,
      user.zynkFundingAccountId
    );

    return response.data;
  }

  async activateFundingAccount(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(
        400,
        "User does not have a Zynk entity. Create entity first."
      );
    }

    if (!user.zynkFundingAccountId) {
      throw new AppError(
        400,
        "User does not have a funding account. Create funding account first."
      );
    }

    const response = await zynkRepository.activateFundingAccount(
      user.zynkEntityId,
      user.zynkFundingAccountId
    );

    await activityLogger.logActivity({
      userId,
      type: ActivityType.ACCOUNT_ACTIVATED,
      status: ActivityStatus.COMPLETE,
      description: "Funding account activated",
      metadata: { fundingAccountId: user.zynkFundingAccountId },
    });

    return response.data.data;
  }

  async deactivateFundingAccount(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(
        400,
        "User does not have a Zynk entity. Create entity first."
      );
    }

    if (!user.zynkFundingAccountId) {
      throw new AppError(
        400,
        "User does not have a funding account. Create funding account first."
      );
    }

    const response = await zynkRepository.deactivateFundingAccount(
      user.zynkEntityId,
      user.zynkFundingAccountId
    );

    await activityLogger.logActivity({
      userId,
      type: ActivityType.ACCOUNT_ACTIVATED,
      status: ActivityStatus.FAILED,
      description: "Funding account deactivated",
      metadata: { fundingAccountId: user.zynkFundingAccountId },
    });

    return response.data.data;
  }

}

export default new ZynkService();
