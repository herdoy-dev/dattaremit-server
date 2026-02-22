import type { RequestHandler } from "express";
import type { AuthRequest } from "./auth";
import AppError from "../lib/AppError";

const hasAddress: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user.addresses || authReq.user.addresses.length === 0) {
      throw new AppError(409, "Please complete the address step first.");
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default hasAddress;
