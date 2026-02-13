import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import type { AuthRequest } from "../middlewares/auth";
import accountService from "../services/account.service";

class AccountController {
  async getAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const account = await accountService.getAccount(req.user.clerkUserId);
      res
        .status(200)
        .json(new APIResponse(true, "Account retrieved successfully", account));
    } catch (error) {
      next(error);
    }
  }
}

export default new AccountController();
