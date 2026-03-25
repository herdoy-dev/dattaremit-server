import type { RequestHandler } from "express";
import * as Sentry from "@sentry/node";
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
    Sentry.getCurrentScope().setTag("user.db_id", String(user.id));
    Sentry.getCurrentScope().setTag("user.account_status", user.accountStatus);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError(500, "Failed to load user data. Please try again later."));
  }
};

export default dbUser;
