import prismaClient from "../lib/prisma-client";

class AppSettingRepository {
  async findByKey(key: string) {
    return prismaClient.appSetting.findUnique({ where: { key } });
  }

  async upsert(key: string, value: string, updatedBy?: string) {
    return prismaClient.appSetting.upsert({
      where: { key },
      update: { value, updatedBy },
      create: { key, value, updatedBy },
    });
  }

  async findAll() {
    return prismaClient.appSetting.findMany({ orderBy: { key: "asc" } });
  }
}

export default new AppSettingRepository();
