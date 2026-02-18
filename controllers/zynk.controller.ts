import type { NextFunction, Response } from "express";
import Joi from "joi";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import {
  withIdempotency,
  type IdempotentHandlerResult,
} from "../lib/idempotency";
import type { AuthRequest } from "../middlewares/auth";
import zynkService from "../services/zynk.service";

const addExternalAccountSchema = Joi.object({
  accountName: Joi.string().trim().min(1).required().messages({
    "string.empty": "Account name cannot be empty",
    "any.required": "Account name is required",
  }),
  paymentRail: Joi.string().trim().min(1).required().messages({
    "string.empty": "Payment rail cannot be empty",
    "any.required": "Payment rail is required",
  }),
  plaidPublicToken: Joi.string().trim().min(1).required().messages({
    "string.empty": "Plaid public token cannot be empty",
    "any.required": "Plaid public token is required",
  }),
  plaidAccountId: Joi.string().trim().min(1).required().messages({
    "string.empty": "Plaid account ID cannot be empty",
    "any.required": "Plaid account ID is required",
  }),
});

const ALLOWED_ANDROID_PACKAGES = new Set(["com.dattapay.mobile"]);
const ALLOWED_REDIRECT_HOSTS = new Set(["dattaremit.com", "localhost"]);

class ZynkController {
  async createEntity(req: AuthRequest, res: Response, next: NextFunction) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "zynk:createEntity" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const dbUser = req.user;
        const user = await zynkService.createEntity(dbUser.id);
        return {
          status: 201,
          response: new APIResponse(
            true,
            "Zynk entity created successfully",
            user
          ),
        };
      }
    );
  }

  async startKyc(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;
      const kycData = await zynkService.startKyc(dbUser.id);
      res
        .status(200)
        .json(new APIResponse(true, "KYC started successfully", kycData));
    } catch (error) {
      next(error);
    }
  }

  async getKycStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;
      const kycStatus = await zynkService.getKycStatus(dbUser.id);
      res
        .status(200)
        .json(
          new APIResponse(true, "KYC status retrieved successfully", kycStatus)
        );
    } catch (error) {
      next(error);
    }
  }

 
  async generatePlaidLinkToken(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const dbUser = req.user;
      const { android_package_name, redirect_uri } = req.body || {};

      if (
        android_package_name !== undefined &&
        !ALLOWED_ANDROID_PACKAGES.has(android_package_name)
      ) {
        throw new AppError(400, "Invalid android_package_name");
      }

      if (redirect_uri !== undefined) {
        try {
          const url = new URL(redirect_uri);
          if (!ALLOWED_REDIRECT_HOSTS.has(url.hostname)) {
            throw new AppError(400, "Invalid redirect_uri");
          }
        } catch {
          throw new AppError(400, "Invalid redirect_uri");
        }
      }

      const result = await zynkService.generatePlaidLinkToken(dbUser.id, {
        androidPackageName: android_package_name,
        redirectUri: redirect_uri,
      });
      res
        .status(200)
        .json(
          new APIResponse(
            true,
            "Plaid link token generated successfully",
            result
          )
        );
    } catch (error) {
      next(error);
    }
  }

  async addExternalAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const dbUser = req.user;
      const { error, value } = addExternalAccountSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(
          400,
          error.details.map((d) => d.message).join(", ")
        );
      }

      const user = await zynkService.addExternalAccount(dbUser.id, value);
      res
        .status(201)
        .json(
          new APIResponse(
            true,
            "External account added and enabled successfully",
            user
          )
        );
    } catch (error) {
      next(error);
    }
  }
}

export default new ZynkController();
