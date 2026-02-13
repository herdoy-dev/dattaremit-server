import type { RequestHandler } from "express";
import type { AuthRequest } from "./auth";
import userService from "../services/user.service";
import AppError from "../lib/AppError";

const dbUser: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const user = await userService.getByClerkUserId(authReq.user.clerkUserId);

    if (!user) {
      throw new AppError(404, "User not found. Please create an account first.");
    }

    authReq.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default dbUser;
