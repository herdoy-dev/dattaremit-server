import prismaClient from "../lib/prisma-client";
import PrismaRepository from "./base.repository";
import type {
  CreateUserInput,
  InternalUpdateUserInput,
} from "../schemas/user.schema";

const baseRepository = new PrismaRepository(prismaClient.user, {
  addresses: true,
});

class UserRepository {
  async findById(id: string) {
    return baseRepository.findUnique({ id });
  }

  async findByEmail(email: string) {
    return baseRepository.findUnique({ email });
  }

  async findByClerkUserId(clerkUserId: string) {
    return baseRepository.findUnique({ clerkUserId });
  }

  async findByZynkEntityId(zynkEntityId: string) {
    const [user] = await baseRepository.findMany({
      where: { zynkEntityId },
      take: 1,
    });
    return user ?? null;
  }

  async create(data: CreateUserInput) {
    return baseRepository.create(data);
  }

  async update(id: string, data: InternalUpdateUserInput) {
    return baseRepository.update({ id }, data);
  }
}

export default new UserRepository();
