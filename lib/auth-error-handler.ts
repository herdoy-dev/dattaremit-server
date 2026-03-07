import type { NextFunction } from "express";
import AppError from "./AppError";

export function handleAuthError(error: unknown, next: NextFunction) {
  if (error instanceof AppError) {
    next(error);
  } else if (error instanceof Error) {
    next(new AppError(401, error.message));
  } else {
    next(new AppError(401, "Invalid or expired token."));
  }
}
