import type {
  Response as ExpressResponse,
  NextFunction,
  Request,
} from "express";
import * as Sentry from "@sentry/node";
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
    // Enrich scope so setupExpressErrorHandler's capture (which runs before
    // this middleware) has correct level and tags — no manual captureException
    // needed, avoiding duplicate events.
    const level = err.status >= 500 ? "error" : "warning";
    Sentry.getCurrentScope().setLevel(level);
    Sentry.getCurrentScope().setTags({ "error.status": err.status, path: req.path, method: req.method });
    return res.status(err.status).send(new APIResponse(false, err.message));
  }
  // setupExpressErrorHandler already captures non-AppError exceptions
  logger.error("Unexpected error", {
    error: err instanceof Error ? err.message : "Unknown error",
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
    requestId: req.headers["x-request-id"],
  });
  return res.status(500).send(new APIResponse(false, "Internal server error"));
};

export default error;
