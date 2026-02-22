import type {
  Response as ExpressResponse,
  NextFunction,
  Request,
} from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import logger from "../lib/logger";

const error = (
  err: Error,
  req: Request,
  res: ExpressResponse,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.status).send(new APIResponse(false, err.message));
  }
  logger.error("Unexpected error", {
    error: err instanceof Error ? err.message : "Unknown error",
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });
  return res.status(500).send(new APIResponse(false, "Internal server error"));
};

export default error;
