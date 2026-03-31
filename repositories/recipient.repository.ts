import prismaClient from "../lib/prisma-client";
import PrismaRepository from "./base.repository";

const baseRepository = new PrismaRepository(prismaClient.recipient);

class RecipientRepository {
  async findById(id: string) {
    return baseRepository.findUnique({ id });
  }

  async findByZynkEntityId(zynkEntityId: string) {
    const [recipient] = await baseRepository.findMany({
      where: { zynkEntityId },
      take: 1,
    });
    return recipient ?? null;
  }

  async findAllByUserId(userId: string) {
    return baseRepository.findMany({
      where: { createdByUserId: userId },
      orderBy: { created_at: "desc" },
    });
  }

  async findByUserIdAndEmail(userId: string, email: string) {
    return baseRepository.findUnique({
      createdByUserId_email: { createdByUserId: userId, email },
    });
  }

  async create(data: Record<string, unknown>) {
    return baseRepository.create(data);
  }

  async update(id: string, data: Record<string, unknown>) {
    return baseRepository.update({ id }, data);
  }
}

export default new RecipientRepository();
