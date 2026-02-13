import type { RequestHandler } from "express";
import AppError from "../lib/AppError";
import type { AuthRequest } from "./auth";

const isApproved: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    if (user.accountStatus !== "ACTIVE") {
      throw new AppError(401, "Account is not approved yet.");
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default isApproved;
