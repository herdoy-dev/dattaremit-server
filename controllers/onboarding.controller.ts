import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import prismaClient, { decryptNestedUser } from "../lib/prisma-client";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import userRepository from "../repositories/user.repository";
import zynkRepository from "../repositories/zynk.repository";
import type { ZynkEntityData } from "../repositories/zynk.repository";
import zynkService from "../services/zynk.service";
import { createAddressSchema } from "../schemas/address.schema";
import { sendKycEmail } from "../services/email.service";
import googleMapsService from "../services/google-maps.service";
import logger from "../lib/logger";

class OnboardingController {
  submitAddress = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dbUser = req.user;

    const value = validate(createAddressSchema, { ...req.body, userId: dbUser.id });

    // Run address validation in parallel with save+entity creation
    const validationPromise = googleMapsService
      .validateAddress({
        addressLine1: value.addressLine1,
        addressLine2: value.addressLine2,
        city: value.city,
        state: value.state,
        country: value.country,
        postalCode: value.postalCode,
      })
      .catch(() => ({ validationStatus: "UNAVAILABLE" as const }));

    // Wrap address save and entity creation in a single transaction
    // so the address is rolled back if entity creation fails
    const result = await prismaClient.$transaction(async (tx) => {
      // Step 1: Save address (upsert by userId + type)
      const existing = await tx.address.findUnique({
        where: { userId_type: { userId: value.userId, type: value.type } },
      });

      let address;
      if (existing) {
        const { userId, type, ...updateFields } = value;
        address = await tx.address.update({
          where: { id: existing.id },
          data: updateFields,
          include: { user: true },
        });
      } else {
        address = await tx.address.create({
          data: value,
          include: { user: true },
        });
      }

      // Step 2: Create Zynk entity if not already created
      let entityCreated = !!dbUser.zynkEntityId;
      if (!dbUser.zynkEntityId) {
        const user = await tx.user.findUnique({
          where: { id: dbUser.id },
          include: { addresses: true },
        });

        if (!user || !user.addresses || user.addresses.length === 0) {
          throw new AppError(400, "At least one address is required to create entity");
        }

        const addresses = user.addresses;
        const entityData: ZynkEntityData = {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName ? user.lastName : " ",
          phoneNumberPrefix: user.phoneNumberPrefix.replace("+", ""),
          phoneNumber: user.phoneNumber,
          dateOfBirth: user.dateOfBirth,
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

        // External API call — if this fails, the entire transaction rolls back
        const response = await zynkRepository.createEntity(entityData);

        await tx.user.update({
          where: { id: dbUser.id },
          data: {
            zynkEntityId: response.data.entityId,
            accountStatus: "PENDING",
          },
        });

        entityCreated = true;
      }

      return {
        address: decryptNestedUser(address as { user?: unknown }),
        entityCreated,
      };
    });

    const validation = await validationPromise;

    res.status(201).json(
      new APIResponse(true, "Address saved and entity created", {
        address: result.address,
        entityCreated: result.entityCreated,
        validation,
      })
    );
  });

  requestKyc = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dbUser = req.user;

    // Create Zynk entity if not already created (fallback)
    if (!dbUser.zynkEntityId) {
      await zynkService.createEntity(dbUser.id);
    }

    // Re-fetch user to get updated zynkEntityId
    const updatedUser = await userRepository.findById(dbUser.id);
    if (!updatedUser || !updatedUser.zynkEntityId) {
      throw new AppError(500, "Failed to create Zynk entity");
    }

    // Start KYC process
    const kycData = await zynkService.startKyc(updatedUser.id);

    // Email the KYC link to the user
    if (kycData.kycLink) {
      const emailSent = await sendKycEmail(
        updatedUser.email,
        kycData.kycLink,
        updatedUser.firstName
      );
      if (!emailSent) {
        logger.warn(
          `KYC email failed to send to user ${updatedUser.id}, but KYC process started`
        );
      }
    }

    res
      .status(200)
      .json(new APIResponse(true, kycData.message || "KYC verification initiated"));
  });
}

export default new OnboardingController();
