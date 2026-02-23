import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import type { AuthRequest } from "../middlewares/auth";
import userService from "../services/user.service";

class ReferralController {
  async validateReferCode(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      if (!code || typeof code !== "string") {
        res
          .status(400)
          .json(new APIResponse(false, "Referral code is required"));
        return;
      }
      const result = await userService.validateReferCode(code.trim());
      res
        .status(200)
        .json(new APIResponse(true, "Referral code checked", result));
    } catch (error) {
      next(error);
    }
  }

  async requestReferCode(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await userService.requestReferCode(req.user.id);
      res
        .status(200)
        .json(new APIResponse(true, "Refer code generated successfully", result));
    } catch (error) {
      next(error);
    }
  }
}

export default new ReferralController();
