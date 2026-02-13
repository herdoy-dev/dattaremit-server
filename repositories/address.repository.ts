import prismaClient from "../lib/prisma-client";
import PrismaRepository from "./base.repository";
import type {
  CreateAddressInput,
  UpdateAddressInput,
} from "../schemas/address.schema";

const baseRepository = new PrismaRepository(
  prismaClient.address,
  { user: true }
);

class AddressRepository {
  async findAllByUserId(userId: string) {
    return baseRepository.findMany({ where: { userId } });
  }

  async findById(id: string) {
    return baseRepository.findUnique({ id });
  }

  async findByUserIdAndType(userId: string, type: string) {
    return baseRepository.findUnique({ userId_type: { userId, type } });
  }

  async create(data: CreateAddressInput) {
    return baseRepository.create(data);
  }

  async update(id: string, data: UpdateAddressInput) {
    return baseRepository.update({ id }, data);
  }

  async delete(id: string) {
    return baseRepository.delete({ id });
  }
}

export default new AddressRepository();
