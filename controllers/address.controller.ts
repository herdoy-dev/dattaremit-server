import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import {
  createAddressSchema,
  updateAddressSchema,
} from "../schemas/address.schema";
import addressService from "../services/address.service";

class AddressController {
  getAllByUserId = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const addresses = await addressService.getAllByUserId(user.id);
    res
      .status(200)
      .json(new APIResponse(true, "Addresses retrieved successfully", addresses));
  });

  getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
      throw new AppError(400, "Address ID is required");
    }
    const address = await addressService.getById(id);
    const addr = address as { userId?: string };
    if (addr.userId !== user.id) {
      throw new AppError(403, "You can only view your own addresses");
    }
    res
      .status(200)
      .json(new APIResponse(true, "Address retrieved successfully", address));
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const value = validate(createAddressSchema, { ...req.body, userId: user.id });

    const address = await addressService.create(value);
    res
      .status(201)
      .json(new APIResponse(true, "Address created successfully", address));
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
      throw new AppError(400, "Address ID is required");
    }

    const bodyValue = validate(updateAddressSchema, req.body);
    const address = await addressService.update(id, user.id, bodyValue);
    res
      .status(200)
      .json(new APIResponse(true, "Address updated successfully", address));
  });

  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const { id } = req.params;
    if (!id) {
      throw new AppError(400, "Address ID is required");
    }
    await addressService.delete(id, user.id);
    res
      .status(200)
      .json(new APIResponse(true, "Address deleted successfully"));
  });
}

export default new AddressController();
