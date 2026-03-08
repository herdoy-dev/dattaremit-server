import type { Response } from "express";
import Joi from "joi";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
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
  paymentRail: Joi.string()
    .trim()
    .valid("ach_pull", "ach_push")
    .optional()
    .default("ach_pull"),
  plaidPublicToken: Joi.string().trim().min(1).required().messages({
    "string.empty": "Plaid public token cannot be empty",
    "any.required": "Plaid public token is required",
  }),
  plaidAccountId: Joi.string().trim().min(1).required().messages({
    "string.empty": "Plaid account ID cannot be empty",
    "any.required": "Plaid account ID is required",
  }),
});

const addDepositAccountSchema = Joi.object({
  bankName: Joi.string().trim().min(1).required().messages({
    "string.empty": "Bank name cannot be empty",
    "any.required": "Bank name is required",
  }),
  accountHolderName: Joi.string().trim().min(1).required().messages({
    "string.empty": "Account holder name cannot be empty",
    "any.required": "Account holder name is required",
  }),
  accountNumber: Joi.string().trim().min(1).required().messages({
    "string.empty": "Account number cannot be empty",
    "any.required": "Account number is required",
  }),
  routingNumber: Joi.string()
    .trim()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Routing number must be in IFSC format (e.g. SBIN0001234)",
      "any.required": "Routing number is required",
    }),
  type: Joi.string().valid("SAVINGS", "CURRENT").required().messages({
    "any.only": "Account type must be SAVINGS or CURRENT",
    "any.required": "Account type is required",
  }),
});

const ALLOWED_ANDROID_PACKAGES = new Set(["com.dattapay.mobile"]);
const ALLOWED_REDIRECT_HOSTS = new Set([
  "dattaremit.com",
  "cdn.plaid.com",
  ...(process.env.NODE_ENV !== "production" ? ["localhost", "cdn-testing.plaid.com"] : []),
]);

class ZynkController {
  async createEntity(req: AuthRequest, res: Response, next: Function) {
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

  startKyc = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dbUser = req.user;
    const kycData = await zynkService.startKyc(dbUser.id);
    res
      .status(200)
      .json(new APIResponse(true, "KYC started successfully", kycData));
  });

  getKycStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dbUser = req.user;
    const kycStatus = await zynkService.getKycStatus(dbUser.id);
    res
      .status(200)
      .json(
        new APIResponse(true, "KYC status retrieved successfully", kycStatus)
      );
  });

  generatePlaidLinkToken = asyncHandler(async (req: AuthRequest, res: Response) => {
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
        if (url.protocol !== "https:" && !(url.hostname === "localhost" && process.env.NODE_ENV !== "production")) {
          throw new AppError(400, "Invalid redirect_uri: HTTPS required");
        }
      } catch (e) {
        if (e instanceof AppError) throw e;
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
  });

  async addExternalAccount(req: AuthRequest, res: Response, next: Function) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "zynk:addExternalAccount" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const value = validate(addExternalAccountSchema, req.body);

        const user = await zynkService.addExternalAccount(req.user.id, value);
        return {
          status: 201,
          response: new APIResponse(
            true,
            "External account added and enabled successfully",
            user
          ),
        };
      }
    );
  }

  async addDepositAccount(req: AuthRequest, res: Response, next: Function) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "zynk:addDepositAccount" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const value = validate(addDepositAccountSchema, req.body);

        const user = await zynkService.addDepositAccount(req.user.id, value);
        return {
          status: 201,
          response: new APIResponse(
            true,
            "Deposit account added and enabled successfully",
            user
          ),
        };
      }
    );
  }
}

export default new ZynkController();
