import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import { createUserSchema, updateUserSchema } from "../schemas/user.schema";
import userService from "../services/user.service";

class UserController {
  getByClerkUserId = asyncHandler(async (req: AuthRequest, res: Response) => {
    const clerkUserId = req.params.clerkUserId;
    if (!clerkUserId) {
      throw new AppError(400, "Clerk user ID is required");
    }

    const user = await userService.getByClerkUserId(clerkUserId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    res
      .status(200)
      .json(new APIResponse(true, "User retrieved successfully", user));
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const value = validate(createUserSchema, req.body);

    // Ensure clerkUserId matches the authenticated user's token
    if (value.clerkUserId !== req.user.clerkUserId) {
      throw new AppError(403, "Cannot create account for a different user");
    }

    // If user already exists, only allow updates if account is still INITIAL
    const existingUser = await userService.getByClerkUserId(value.clerkUserId);
    if (existingUser) {
      if (existingUser.accountStatus !== "INITIAL") {
        throw new AppError(403, "Profile cannot be modified after KYC approval. Use the update endpoint instead.");
      }
      const { clerkUserId, referredByCode: _referredByCode, ...updateData } = value;
      const updatedUser = await userService.update(existingUser.id, updateData);
      return res
        .status(200)
        .json(new APIResponse(true, "Profile updated successfully", updatedUser));
    }

    const user = await userService.create(value);
    res
      .status(201)
      .json(new APIResponse(true, "User created successfully", user));
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dbUser = req.user;
    const bodyValue = validate(updateUserSchema, req.body);

    const user = await userService.update(dbUser.id, bodyValue);
    res
      .status(200)
      .json(new APIResponse(true, "User updated successfully", user));
  });
}

export default new UserController();
