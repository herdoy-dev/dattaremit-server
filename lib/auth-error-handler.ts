import type { NextFunction } from "express";
import AppError from "./AppError";
import logger from "./logger";

export function handleAuthError(error: unknown, next: NextFunction) {
  if (error instanceof AppError) {
    return next(error);
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  logger.warn("Auth error", { type: message.split(" ").slice(0, 4).join(" ") });

  if (message.includes("expired")) {
    return next(new AppError(401, "Your session has expired. Please sign in again."));
  }
  if (message.includes("malformed") || message.includes("invalid format")) {
    return next(new AppError(401, "Invalid authentication token."));
  }
  if (message.includes("signature") || message.includes("verification")) {
    return next(new AppError(401, "Authentication failed. Please sign in again."));
  }

  next(new AppError(401, "Invalid or expired token. Please sign in again."));
}
