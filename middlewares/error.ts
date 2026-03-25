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
  // Handle Prisma errors with user-friendly messages
  if (err.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as Error & { code: string };
    if (prismaErr.code === "P2002") {
      return res.status(409).send(new APIResponse(false, "A record with this information already exists."));
    }
    if (prismaErr.code === "P2025") {
      return res.status(404).send(new APIResponse(false, "The requested record was not found."));
    }
    if (prismaErr.code === "P2003") {
      return res.status(400).send(new APIResponse(false, "Invalid reference. A related record does not exist."));
    }
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
