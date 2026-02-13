import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import {
  withIdempotency,
  type IdempotentHandlerResult,
} from "../lib/idempotency";
import type { AuthRequest } from "../middlewares/auth";
import zynkService from "../services/zynk.service";

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

  async createFundingAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "zynk:createFundingAccount" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const dbUser = req.user;
        const result = await zynkService.createFundingAccount(dbUser.id);
        return {
          status: 201,
          response: new APIResponse(
            true,
            "Funding account created successfully",
            result
          ),
        };
      }
    );
  }

  async getFundingAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;
      const fundingAccount = await zynkService.getFundingAccount(dbUser.id);
      res
        .status(200)
        .json(
          new APIResponse(
            true,
            "Funding account retrieved successfully",
            fundingAccount
          )
        );
    } catch (error) {
      next(error);
    }
  }

  async activateFundingAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "zynk:activateFundingAccount" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const dbUser = req.user;
        const fundingAccount = await zynkService.activateFundingAccount(
          dbUser.id
        );
        return {
          status: 200,
          response: new APIResponse(
            true,
            "Funding account activated successfully",
            fundingAccount
          ),
        };
      }
    );
  }

  async deactivateFundingAccount(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const dbUser = req.user;
      const fundingAccount = await zynkService.deactivateFundingAccount(
        dbUser.id
      );
      res
        .status(200)
        .json(
          new APIResponse(
            true,
            "Funding account deactivated successfully",
            fundingAccount
          )
        );
    } catch (error) {
      next(error);
    }
  }
}

export default new ZynkController();
