import { ActivityStatus, ActivityType } from "../generated/prisma/client";
import activityLogger from "../lib/activity-logger";
import AppError from "../lib/AppError";
import prismaClient, { decryptUserData } from "../lib/prisma-client";
import addressRepository from "../repositories/address.repository";
import userRepository from "../repositories/user.repository";
import type {
  ZynkEntityData,
  ZynkAddExternalAccountData,
  ZynkAddDepositAccountData,
} from "../repositories/zynk.repository";
import zynkRepository from "../repositories/zynk.repository";

class ZynkService {
  async createEntity(userId: string) {
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        include: { addresses: true },
      });

      if (!currentUser) {
        throw new AppError(404, "User not found");
      }

      // If entity already exists, return the user as-is (idempotent)
      if (currentUser.zynkEntityId) {
        return currentUser;
      }

      if (!currentUser.addresses || currentUser.addresses.length === 0) {
        throw new AppError(
          400,
          "At least one address is required to create entity",
        );
      }

      const addresses = currentUser.addresses;

      const entityData: ZynkEntityData = {
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName ? currentUser.lastName : " ",
        phoneNumberPrefix: currentUser.phoneNumberPrefix.replace("+", ""),
        phoneNumber: currentUser.phoneNumber,
        dateOfBirth: currentUser.dateOfBirth,
        nationality: addresses[0]?.country as string,
        permanentAddress: {
          addressLine1: addresses[0]?.addressLine1 as string,
          addressLine2: addresses[0]?.addressLine2 as string,
          locality: addresses[0]?.state as string,
          city: addresses[0]?.city as string,
          state: addresses[0]?.state as string,
          country: addresses[0]?.country as string,
          postalCode: addresses[0]?.postalCode as string,
        },
      };

      // Call external API inside the transaction
      const response = await zynkRepository.createEntity(entityData);

      return tx.user.update({
        where: { id: userId },
        data: {
          zynkEntityId: response.data.entityId,
          accountStatus: "PENDING",
        },
        include: { addresses: true },
      });
    }, {
      isolationLevel: "Serializable",
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
        "User does not have a Zynk entity. Create entity first.",
      );
    }

    if (!user.nationality) {
      throw new AppError(
        400,
        "User nationality is required for KYC. Please set your nationality first.",
      );
    }

    const response = await zynkRepository.startKyc(
      user.zynkEntityId,
      user.nationality,
    );

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
        "User does not have a Zynk entity. Create entity first.",
      );
    }

    const response = await zynkRepository.getKycStatus(user.zynkEntityId);

    return response.data;
  }

  async addExternalAccount(userId: string, data: ZynkAddExternalAccountData) {
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError(404, "User not found");
      }

      if (!user.zynkEntityId) {
        throw new AppError(
          400,
          "User does not have a Zynk entity. Create entity first.",
        );
      }

      // Enforce payment rail eligibility
      const resolvedPaymentRail =
        data.paymentRail === "ach_push" && user.achPushEnabled
          ? "ach_push"
          : "ach_pull";

      // Call external API inside the serializable transaction
      const addResponse = await zynkRepository.addExternalAccount(
        user.zynkEntityId,
        { ...data, paymentRail: resolvedPaymentRail },
      );

      const externalAccountId = addResponse.data.accountId;

      const updated = await tx.user.update({
        where: { id: userId },
        data: { zynkExternalAccountId: externalAccountId },
        include: { addresses: true },
      });

      // Activate the external account
      await zynkRepository.enableExternalAccount(
        user.zynkEntityId,
        externalAccountId,
      );

      await activityLogger.logActivity({
        userId,
        type: ActivityType.ACCOUNT_ACTIVATED,
        status: ActivityStatus.COMPLETE,
        description: "External account added and enabled",
        metadata: {
          entityId: user.zynkEntityId,
          externalAccountId,
        },
      });

      return updated;
    }, {
      isolationLevel: "Serializable",
    });

    return decryptUserData(updatedUser);
  }

  async addDepositAccount(userId: string, data: ZynkAddDepositAccountData) {
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError(404, "User not found");
      }

      if (!user.zynkEntityId) {
        throw new AppError(
          400,
          "User does not have a Zynk entity. Create entity first.",
        );
      }

      // Call external API inside the serializable transaction
      const addResponse = await zynkRepository.addDepositAccount(
        user.zynkEntityId,
        data,
      );

      const depositAccountId = addResponse.data.accountId;

      const updated = await tx.user.update({
        where: { id: userId },
        data: { zynkDepositAccountId: depositAccountId },
        include: { addresses: true },
      });

      // Activate the deposit account
      await zynkRepository.enableExternalAccount(
        user.zynkEntityId,
        depositAccountId,
      );

      await activityLogger.logActivity({
        userId,
        type: ActivityType.ACCOUNT_ACTIVATED,
        status: ActivityStatus.COMPLETE,
        description: "Deposit account added and enabled",
        metadata: {
          entityId: user.zynkEntityId,
          depositAccountId,
        },
      });

      return updated;
    }, {
      isolationLevel: "Serializable",
    });

    return decryptUserData(updatedUser);
  }

  async generatePlaidLinkToken(
    userId: string,
    options?: { androidPackageName?: string; redirectUri?: string },
  ) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(
        400,
        "User does not have a Zynk entity. Create entity first.",
      );
    }

    return zynkRepository.generatePlaidLinkToken(user.zynkEntityId, options);
  }
}

export default new ZynkService();
