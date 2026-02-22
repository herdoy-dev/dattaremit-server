import { verifyToken } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import type { User } from "../generated/prisma/client";
import AppError from "../lib/AppError";

export interface AuthRequest extends Request {
  user: User;
}

export default async function auth(
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

    (req as AuthRequest).user = {
      clerkUserId: decoded.sub,
    } as User;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (error instanceof Error) {
      next(new AppError(401, error.message));
    } else {
      next(new AppError(401, "Invalid or expired token."));
    }
  }
}
