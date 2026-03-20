import { verifyToken } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import * as Sentry from "@sentry/node";
import type { AuthRequest } from "./auth";
import AppError from "../lib/AppError";
import { handleAuthError } from "../lib/auth-error-handler";
import userService from "../services/user.service";

export default async function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.header("x-auth-token") as string;
    if (!token) {
      return next(new AppError(401, "Access denied. No token provided."));
    }

    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY as string,
    });

    const user = await userService.getByClerkUserId(decoded.sub as string);
    if (!user) {
      return next(new AppError(401, "User not found."));
    }

    if (user.role !== "ADMIN") {
      return next(new AppError(403, "Admin access required."));
    }

    (req as AuthRequest).user = user;
    Sentry.setUser({ id: decoded.sub, username: String(user.id) });
    next();
  } catch (error) {
    handleAuthError(error, next);
  }
}
