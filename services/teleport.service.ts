import AppError from "../lib/AppError";
import prismaClient from "../lib/prisma-client";
import userRepository from "../repositories/user.repository";
import externalAccountsRepository from "../repositories/external-accounts.repository";
import teleportRepository from "../repositories/teleport.repository";
import activityLogger from "../lib/activity-logger";
import { ActivityStatus, ActivityType } from "../generated/prisma/client";

// Local types (previously in teleport.schema.ts)
type CreateTeleportInput = {
  externalAccountId: string;
};

type UpdateTeleportInput = {
  externalAccountId: string;
};

class TeleportService {
  private async validateAndCallZynkApi(
    userId: string,
    externalAccountId: string
  ) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (!user.zynkEntityId) {
      throw new AppError(400, "User must have a Zynk entity");
    }

    if (!user.zynkFundingAccountId) {
      throw new AppError(400, "User must have a funding account");
    }

    const externalAccount = await externalAccountsRepository.findById(
      externalAccountId,
      userId
    );

    if (!externalAccount) {
      throw new AppError(404, "External account not found");
    }

    if (!externalAccount.zynkExternalAccountId) {
      throw new AppError(400, "External account not registered with Zynk");
    }

    const zynkResponse = await teleportRepository.createTeleportInZynk(
      user.zynkFundingAccountId,
      externalAccount.zynkExternalAccountId
    );

    return zynkResponse;
  }

  async create(userId: string, data: CreateTeleportInput) {
    const zynkResponse = await this.validateAndCallZynkApi(
      userId,
      data.externalAccountId
    );

    return prismaClient.$transaction(async (tx) => {
      const existingTeleport = await tx.teleport.findUnique({
        where: { userId },
      });

      if (existingTeleport) {
        throw new AppError(409, "User already has a teleport");
      }

      const createdTeleport = await tx.teleport.create({
        data: {
          userId,
          externalAccountId: data.externalAccountId,
          zynkTeleportId: zynkResponse.data.teleportId,
        },
        include: { externalAccount: true },
      });

      await activityLogger.logActivity({
        userId,
        type: ActivityType.DEPOSIT,
        status: ActivityStatus.COMPLETE,
        description: "Teleport created",
        metadata: {
          teleportId: createdTeleport.id,
          externalAccountId: createdTeleport.externalAccountId,
          zynkTeleportId: createdTeleport.zynkTeleportId,
        },
      });

      return createdTeleport;
    });
  }

  async get(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const teleport = await teleportRepository.findByUserId(userId);
    if (!teleport) {
      throw new AppError(404, "Teleport not found");
    }

    return teleport;
  }

  async update(userId: string, data: UpdateTeleportInput) {
    const zynkResponse = await this.validateAndCallZynkApi(
      userId,
      data.externalAccountId
    );

    return prismaClient.$transaction(async (tx) => {
      const existingTeleport = await tx.teleport.findUnique({
        where: { userId },
      });

      if (!existingTeleport) {
        throw new AppError(404, "Teleport not found");
      }

      const updatedTeleport = await tx.teleport.update({
        where: { userId },
        data: {
          externalAccountId: data.externalAccountId,
          zynkTeleportId: zynkResponse.data.teleportId,
        },
        include: { externalAccount: true },
      });

      await activityLogger.logActivity({
        userId,
        type: ActivityType.DEPOSIT,
        status: ActivityStatus.COMPLETE,
        description: "Teleport updated",
        metadata: {
          teleportId: updatedTeleport.id,
          externalAccountId: updatedTeleport.externalAccountId,
          zynkTeleportId: updatedTeleport.zynkTeleportId,
        },
      });

      return updatedTeleport;
    });
  }
}

export default new TeleportService();
