import * as Sentry from "@sentry/node";
import AppError from "../lib/AppError";
import notificationLogger from "../lib/notification-logger";
import prismaClient from "../lib/prisma-client";
import { NotificationType } from "../generated/prisma/client";
import addressRepository from "../repositories/address.repository";
import type {
  CreateAddressInput,
  UpdateAddressInput,
} from "../schemas/address.schema";
import googleMapsService from "./google-maps.service";

class AddressService {
  async getAllByUserId(userId: string) {
    const addresses = await addressRepository.findAllByUserId(userId);
    return addresses;
  }

  async getById(id: string) {
    const address = await addressRepository.findById(id);
    if (!address) {
      throw new AppError(404, "Address not found");
    }
    return address;
  }

  async create(data: CreateAddressInput) {
    return Sentry.startSpan(
      { name: "address.create", op: "db.transaction", attributes: { "address.type": data.type } },
      async () => {
    const [address, validation] = await Promise.all([
      prismaClient.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: data.userId },
        });

        if (!user) {
          throw new AppError(404, "User not found");
        }

        // If address of this type already exists, update it instead
        const existing = await tx.address.findUnique({
          where: { userId_type: { userId: data.userId, type: data.type } },
        });

        if (existing) {
          const { userId, type, ...updateFields } = data;
          const updated = await tx.address.update({
            where: { id: existing.id },
            data: updateFields,
            include: { user: true },
          });
          return updated;
        }

        const address = await tx.address.create({
          data,
          include: { user: true },
        });

        return address;
      }),
      googleMapsService
        .validateAddress({
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postalCode,
        })
        .catch(() => ({ validationStatus: "UNAVAILABLE" as const })),
    ]);

    notificationLogger.notify({
      userId: data.userId,
      type: NotificationType.PROFILE_UPDATED,
      title: "Address Updated",
      body: "Your address information has been successfully updated.",
    });

    return { ...address, validation };
      },
    );
  }

  async update(id: string, userId: string, data: UpdateAddressInput) {
    return Sentry.startSpan(
      { name: "address.update", op: "db.transaction", attributes: { "address.id": id } },
      async () => {
    const address = await addressRepository.findById(id);
    if (!address) {
      throw new AppError(404, "Address not found");
    }
    // Ensure the address belongs to the authenticated user
    const addr = address as { userId?: string };
    if (addr.userId !== userId) {
      throw new AppError(403, "You can only update your own addresses");
    }

    const hasAddressFields =
      data.addressLine1 || data.city || data.state || data.country || data.postalCode;

    const existingAddress = address as {
      addressLine1: string;
      addressLine2?: string | null;
      city: string;
      state: string;
      country: "US" | "IN";
      postalCode: string;
    };

    const [updated, validation] = await Promise.all([
      addressRepository.update(id, data),
      hasAddressFields
        ? googleMapsService
            .validateAddress({
              addressLine1: data.addressLine1 ?? existingAddress.addressLine1,
              addressLine2:
                data.addressLine2 ??
                (existingAddress.addressLine2 === null
                  ? undefined
                  : existingAddress.addressLine2),
              city: data.city ?? existingAddress.city,
              state: data.state ?? existingAddress.state,
              country: (data.country ?? existingAddress.country) as "US" | "IN",
              postalCode: data.postalCode ?? existingAddress.postalCode,
            })
            .catch(() => ({ validationStatus: "UNAVAILABLE" as const }))
        : Promise.resolve(undefined),
    ]);

    notificationLogger.notify({
      userId,
      type: NotificationType.PROFILE_UPDATED,
      title: "Address Updated",
      body: "Your address information has been successfully updated.",
    });

    return validation ? { ...updated, validation } : updated;
      },
    );
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
