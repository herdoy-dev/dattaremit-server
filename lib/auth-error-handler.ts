import type { NextFunction } from "express";
import AppError from "./AppError";
import logger from "./logger";

export function handleAuthError(error: unknown, next: NextFunction) {
  if (error instanceof AppError) {
    next(error);
  } else if (error instanceof Error) {
    logger.warn("Auth error suppressed", { message: error.message });
    next(new AppError(401, "Invalid or expired token."));
  } else {
    next(new AppError(401, "Invalid or expired token."));
  }
}
