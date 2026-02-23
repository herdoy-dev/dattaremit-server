import type { RequestHandler } from "express";
import type { AuthRequest } from "./auth";
import type { Address } from "../generated/prisma/client";
import AppError from "../lib/AppError";

const hasAddress: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user as AuthRequest["user"] & { addresses?: Address[] };
    if (!user.addresses || user.addresses.length === 0) {
      throw new AppError(409, "Please complete the address step first.");
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default hasAddress;
