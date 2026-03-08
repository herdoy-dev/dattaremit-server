import type { Request, Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import type { AuthRequest } from "../middlewares/auth";
import userService from "../services/user.service";

class ReferralController {
  validateReferCode = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      res
        .status(400)
        .json(new APIResponse(false, "Referral code is required"));
      return;
    }
    const result = await userService.validateReferCode(code.trim().toUpperCase());
    res
      .status(200)
      .json(new APIResponse(true, "Referral code checked", result));
  });

  requestReferCode = asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await userService.requestReferCode(req.user.id);
    res
      .status(200)
      .json(new APIResponse(true, "Refer code generated successfully", result));
  });

  getTrackerStats = asyncHandler(async (req: Request, res: Response) => {
    const { referCode } = req.params;
    if (!referCode || !/^[A-Z0-9-]{1,50}$/i.test(referCode)) {
      throw new AppError(400, "Invalid referral code format");
    }
    const result = await userService.getReferralTrackerStats(
      referCode.trim().toUpperCase()
    );
    res
      .status(200)
      .json(new APIResponse(true, "Tracker stats retrieved", result));
  });
}

export default new ReferralController();
