import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import type { AuthRequest } from "../middlewares/auth";
import {
  createAddressSchema,
  updateAddressSchema,
} from "../schemas/address.schema";
import addressService from "../services/address.service";

class AddressController {
  async getAllByUserId(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const addresses = await addressService.getAllByUserId(user.id);
      res
        .status(200)
        .json(new APIResponse(true, "Addresses retrieved successfully", addresses));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { id } = req.params;
      if (!id) {
        throw new AppError(400, "Address ID is required");
      }
      const address = await addressService.getById(id);
      // Ensure the address belongs to the authenticated user
      const addr = address as { userId?: string };
      if (addr.userId !== user.id) {
        throw new AppError(403, "You can only view your own addresses");
      }
      res
        .status(200)
        .json(new APIResponse(true, "Address retrieved successfully", address));
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { error, value } = createAddressSchema.validate(
        { ...req.body, userId: user.id },
        {
          abortEarly: false,
          stripUnknown: true,
        }
      );

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      const address = await addressService.create(value);
      res
        .status(201)
        .json(new APIResponse(true, "Address created successfully", address));
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { id } = req.params;
      if (!id) {
        throw new AppError(400, "Address ID is required");
      }

      const { error: bodyError, value: bodyValue } =
        updateAddressSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });

      if (bodyError) {
        throw new AppError(
          400,
          bodyError.details.map((d) => d.message).join(", ")
        );
      }
      const address = await addressService.update(id, user.id, bodyValue);
      res
        .status(200)
        .json(new APIResponse(true, "Address updated successfully", address));
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { id } = req.params;
      if (!id) {
        throw new AppError(400, "Address ID is required");
      }
      await addressService.delete(id, user.id);
      res
        .status(200)
        .json(new APIResponse(true, "Address deleted successfully"));
    } catch (error) {
      next(error);
    }
  }
}

export default new AddressController();
