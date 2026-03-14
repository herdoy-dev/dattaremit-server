import { ActivityStatus, ActivityType } from "../generated/prisma/client";
import activityLogger from "../lib/activity-logger";
import AppError from "../lib/AppError";
import { toPublicUser } from "../lib/dto";
import prismaClient, { decryptUserData } from "../lib/prisma-client";
import userRepository from "../repositories/user.repository";
import type {
  ZynkEntityData,
  ZynkAddExternalAccountData,
  ZynkAddDepositAccountData,
} from "../repositories/zynk.repository";
import zynkRepository from "../repositories/zynk.repository";

async function requireUserWithEntity(userId: string) {
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

  return user;
}

class ZynkService {
  async createEntity(userId: string) {
    // Phase 1: Read and validate data outside transaction
    const currentUser = await prismaClient.user.findUnique({
      where: { id: userId },
      include: { addresses: true },
    });

    if (!currentUser) {
      throw new AppError(404, "User not found");
    }

    // If entity already exists, return the user as-is (idempotent)
    if (currentUser.zynkEntityId) {
      return toPublicUser(decryptUserData(currentUser));
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
      phoneNumberPrefix: currentUser.phoneNumberPrefix,
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

    // Call external API outside transaction
    const response = await zynkRepository.createEntity(entityData);

    // Phase 2: Short DB-only transaction with optimistic check
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({
        where: { id: userId },
      });

      // Optimistic check: another request may have set entityId concurrently
      if (freshUser?.zynkEntityId) {
        return tx.user.findUnique({
          where: { id: userId },
          include: { addresses: true },
        });
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

    return toPublicUser(decryptUserData(updatedUser!));
  }

  async startKyc(userId: string) {
    const user = await requireUserWithEntity(userId);

    if (!user.nationality) {
      throw new AppError(
        400,
        "User nationality is required for KYC. Please set your nationality first.",
      );
    }

    const response = await zynkRepository.startKyc(
      user.zynkEntityId!,
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
    const user = await requireUserWithEntity(userId);

    const response = await zynkRepository.getKycStatus(user.zynkEntityId!);

    return response.data;
  }

  async addExternalAccount(userId: string, data: ZynkAddExternalAccountData) {
    // Phase 1: Read and validate data outside transaction
    const user = await prismaClient.user.findUnique({ where: { id: userId } });
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

    // Call external APIs outside transaction
    const addResponse = await zynkRepository.addExternalAccount(
      user.zynkEntityId,
      { ...data, paymentRail: resolvedPaymentRail },
    );

    const externalAccountId = addResponse.data.accountId;

    await zynkRepository.enableExternalAccount(
      user.zynkEntityId,
      externalAccountId,
    );

    // Phase 2: Short DB-only transaction with optimistic check
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({ where: { id: userId } });

      // Optimistic check: another request may have set externalAccountId concurrently
      if (freshUser?.zynkExternalAccountId) {
        return tx.user.findUnique({
          where: { id: userId },
          include: { addresses: true },
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: { zynkExternalAccountId: externalAccountId },
        include: { addresses: true },
      });
    });

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

    return toPublicUser(decryptUserData(updatedUser!));
  }

  async addDepositAccount(userId: string, data: ZynkAddDepositAccountData) {
    // Phase 1: Read and validate data outside transaction
    const user = await prismaClient.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(
        400,
        "User does not have a Zynk entity. Create entity first.",
      );
    }

    // Call external APIs outside transaction
    const addResponse = await zynkRepository.addDepositAccount(
      user.zynkEntityId,
      data,
    );

    const depositAccountId = addResponse.data.accountId;

    await zynkRepository.enableExternalAccount(
      user.zynkEntityId,
      depositAccountId,
    );

    // Phase 2: Short DB-only transaction with optimistic check
    const updatedUser = await prismaClient.$transaction(async (tx) => {
      const freshUser = await tx.user.findUnique({ where: { id: userId } });

      // Optimistic check: another request may have set depositAccountId concurrently
      if (freshUser?.zynkDepositAccountId) {
        return tx.user.findUnique({
          where: { id: userId },
          include: { addresses: true },
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: { zynkDepositAccountId: depositAccountId },
        include: { addresses: true },
      });
    });

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

    return toPublicUser(decryptUserData(updatedUser!));
  }

  async generatePlaidLinkToken(
    userId: string,
    options?: { androidPackageName?: string; redirectUri?: string },
  ) {
    const user = await requireUserWithEntity(userId);

    return zynkRepository.generatePlaidLinkToken(user.zynkEntityId!, options);
  }
}

export default new ZynkService();
