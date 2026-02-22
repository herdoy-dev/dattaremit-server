import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import type { AuthRequest } from "../middlewares/auth";
import { createUserSchema, updateUserSchema } from "../schemas/user.schema";
import userService from "../services/user.service";

class UserController {
  async getByClerkUserId(req: AuthRequest, res: Response, next: NextFunction) {
    try {
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
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { error, value } = createUserSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      // Ensure clerkUserId matches the authenticated user's token
      if (value.clerkUserId !== req.user.clerkUserId) {
        throw new AppError(403, "Cannot create account for a different user");
      }

      // If user already exists, update their profile data
      const existingUser = await userService.getByClerkUserId(value.clerkUserId);
      if (existingUser) {
        const { clerkUserId, ...updateData } = value;
        const updatedUser = await userService.update(existingUser.id, updateData);
        return res
          .status(200)
          .json(new APIResponse(true, "Profile updated successfully", updatedUser));
      }

      const user = await userService.create(value);
      res
        .status(201)
        .json(new APIResponse(true, "User created successfully", user));
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;
      const { error: bodyError, value: bodyValue } = updateUserSchema.validate(
        req.body,
        { abortEarly: false, stripUnknown: true }
      );

      if (bodyError) {
        throw new AppError(
          400,
          bodyError.details.map((d) => d.message).join(", ")
        );
      }

      const user = await userService.update(dbUser.id, bodyValue);
      res
        .status(200)
        .json(new APIResponse(true, "User updated successfully", user));
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
