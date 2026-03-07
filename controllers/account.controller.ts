import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import asyncHandler from "../lib/async-handler";
import type { AuthRequest } from "../middlewares/auth";
import accountService from "../services/account.service";

class AccountController {
  getAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const account = await accountService.getAccount(req.user.clerkUserId);
    res
      .status(200)
      .json(new APIResponse(true, "Account retrieved successfully", account));
  });
}

export default new AccountController();
