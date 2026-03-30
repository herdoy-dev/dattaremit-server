import type { Request, Response } from "express";
import Joi from "joi";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import userService from "../services/user.service";

const validateReferCodeSchema = Joi.object({
  code: Joi.string().trim().uppercase().min(1).max(20).required()
    .messages({ "any.required": "Referral code is required." }),
});

class ReferralController {
  validateReferCode = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { code } = validate(validateReferCodeSchema, req.body);
    const result = await userService.validateReferCode(code);
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
