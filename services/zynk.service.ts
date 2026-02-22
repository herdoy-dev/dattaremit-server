import { ActivityStatus, ActivityType } from "../generated/prisma/client";
import activityLogger from "../lib/activity-logger";
import AppError from "../lib/AppError";
import prismaClient, { decryptUserData } from "../lib/prisma-client";
import userRepository from "../repositories/user.repository";
import type {
  ZynkEntityData,
  ZynkAddExternalAccountData,
  ZynkAddDepositAccountData,
} from "../repositories/zynk.repository";
import zynkRepository from "../repositories/zynk.repository";

class ZynkService {
  async createEntity(userId: string) {
    // Initial validation
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const entityData: ZynkEntityData = {
      email: user.email,
      phoneNumberPrefix: user.phoneNumberPrefix.replace("+", ""),
      phoneNumber: user.phoneNumber,
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

      // If entity already exists, return the user as-is (idempotent)
      if (currentUser.zynkEntityId) {
        return currentUser;
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

  async addExternalAccount(
    userId: string,
    data: ZynkAddExternalAccountData
  ) {
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

    // Step 1: Add external account via Zynk API
    const addResponse = await zynkRepository.addExternalAccount(
      user.zynkEntityId,
      data
    );

    const externalAccountId = addResponse.data.accountId;

    // Step 2: Save external account ID to user in a transaction
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      return tx.user.update({
        where: { id: userId },
        data: { zynkExternalAccountId: externalAccountId },
        include: { addresses: true },
      });
    });

    // Step 3: Activate the external account
    await zynkRepository.enableExternalAccount(
      user.zynkEntityId,
      externalAccountId
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

    return decryptUserData(updatedUser);
  }

  async addDepositAccount(
    userId: string,
    data: ZynkAddDepositAccountData
  ) {
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

    // Step 1: Add deposit account via Zynk API
    const addResponse = await zynkRepository.addDepositAccount(
      user.zynkEntityId,
      data
    );

    const depositAccountId = addResponse.data.accountId;

    // Step 2: Save deposit account ID to user in a transaction
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      return tx.user.update({
        where: { id: userId },
        data: { zynkDepositAccountId: depositAccountId },
        include: { addresses: true },
      });
    });

    // Step 3: Activate the deposit account
    await zynkRepository.enableExternalAccount(
      user.zynkEntityId,
      depositAccountId
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

    return decryptUserData(updatedUser);
  }

  async generatePlaidLinkToken(
    userId: string,
    options?: { androidPackageName?: string; redirectUri?: string }
  ) {
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

    return zynkRepository.generatePlaidLinkToken(user.zynkEntityId, options);
  }
}

export default new ZynkService();
