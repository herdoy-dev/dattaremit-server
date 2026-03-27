
// this is a device repo

import prismaClient from "../lib/prisma-client";

class DeviceRepository {
  async findByUserId(userId: string) {
    return prismaClient.userDevice.findMany({
      where: { userId },
      orderBy: { lastActiveAt: "desc" },
    });
  }

  async findByToken(expoPushToken: string) {
    return prismaClient.userDevice.findUnique({
      where: { expoPushToken },
    });
  }

  async upsertByToken(data: {
    userId: string;
    expoPushToken: string;
    platform: string;
    deviceName?: string;
  }) {
    return prismaClient.userDevice.upsert({
      where: { expoPushToken: data.expoPushToken },
      update: {
        userId: data.userId,
        platform: data.platform as any,
        deviceName: data.deviceName,
        lastActiveAt: new Date(),
      },
      create: data as any,
    });
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    return prismaClient.userDevice.delete({
      where: { id, userId },
    });
  }

  async deleteByToken(token: string) {
    return prismaClient.userDevice.delete({
      where: { expoPushToken: token },
    });
  }
}

export default new DeviceRepository();
