import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import type { AuthRequest } from "../middlewares/auth";
import userRepository from "../repositories/user.repository";
import zynkService from "../services/zynk.service";
import addressService from "../services/address.service";
import { createAddressSchema } from "../schemas/address.schema";
import { sendKycEmail } from "../services/email.service";
import logger from "../lib/logger";

class OnboardingController {
  async submitAddress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;

      // Step 1: Validate and save the address
      const { error, value } = createAddressSchema.validate(
        { ...req.body, userId: dbUser.id },
        { abortEarly: false, stripUnknown: true }
      );

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      const address = await addressService.create(value);

      // Step 2: Create Zynk entity if not already created
      if (!dbUser.zynkEntityId) {
        await zynkService.createEntity(dbUser.id);
      }

      const updatedUser = await userRepository.findById(dbUser.id);

      res.status(201).json(
        new APIResponse(true, "Address saved and entity created", {
          address,
          entityCreated: !!updatedUser?.zynkEntityId,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async requestKyc(req: AuthRequest, res: Response, next: NextFunction) {
    try {
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
        .json(new APIResponse(true, "KYC verification link sent to your email"));
    } catch (error) {
      next(error);
    }
  }
}

export default new OnboardingController();
