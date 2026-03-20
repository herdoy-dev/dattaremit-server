import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";

export default function requestId(req: Request, res: Response, next: NextFunction) {
  const clientId = req.headers["x-request-id"] as string;
  const id = (clientId && /^[a-zA-Z0-9-]{1,64}$/.test(clientId)) ? clientId : randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-Id", id);
  Sentry.getCurrentScope().setTag("request_id", id);
  next();
}
