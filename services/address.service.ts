import AppError from "../lib/AppError";
import prismaClient, { decryptNestedUser } from "../lib/prisma-client";
import addressRepository from "../repositories/address.repository";
import type {
  CreateAddressInput,
  UpdateAddressInput,
} from "../schemas/address.schema";

class AddressService {
  async getAllByUserId(userId: string) {
    const addresses = await addressRepository.findAllByUserId(userId);
    return addresses.map((a) => decryptNestedUser(a as { user?: unknown }));
  }

  async getById(id: string) {
    const address = await addressRepository.findById(id);
    if (!address) {
      throw new AppError(404, "Address not found");
    }
    return decryptNestedUser(address as { user?: unknown });
  }

  async create(data: CreateAddressInput) {
    return prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: data.userId },
      });

      if (!user) {
        throw new AppError(404, "User not found");
      }

      // Check if user already has an address of this type
      const existing = await tx.address.findUnique({
        where: { userId_type: { userId: data.userId, type: data.type } },
      });

      if (existing) {
        throw new AppError(409, `User already has a ${data.type} address`);
      }

      const address = await tx.address.create({
        data,
        include: { user: true },
      });

      return decryptNestedUser(address);
    });
  }

  async update(id: string, userId: string, data: UpdateAddressInput) {
    const address = await addressRepository.findById(id);
    if (!address) {
      throw new AppError(404, "Address not found");
    }
    // Ensure the address belongs to the authenticated user
    const addr = address as { userId?: string };
    if (addr.userId !== userId) {
      throw new AppError(403, "You can only update your own addresses");
    }
    const updated = await addressRepository.update(id, data);
    return decryptNestedUser(updated as { user?: unknown });
  }

  async delete(id: string, userId: string) {
    const address = await addressRepository.findById(id);
    if (!address) {
      throw new AppError(404, "Address not found");
    }
    const addr = address as { userId?: string };
    if (addr.userId !== userId) {
      throw new AppError(403, "You can only delete your own addresses");
    }
    return addressRepository.delete(id);
  }
}

export default new AddressService();
