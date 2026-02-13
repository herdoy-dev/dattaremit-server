import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import {
  withIdempotency,
  type IdempotentHandlerResult,
} from "../lib/idempotency";
import type { AuthRequest } from "../middlewares/auth";
import externalAccountsService from "../services/external-accounts.service";
import {
  createExternalAccountSchema,
  externalAccountIdSchema,
} from "../schemas/external-accounts.schema";

class ExternalAccountsController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "externalAccounts:create" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const dbUser = req.user;
        const { error, value } = createExternalAccountSchema.validate(
          req.body,
          {
            abortEarly: false,
            stripUnknown: true,
          }
        );

        if (error) {
          throw new AppError(
            400,
            error.details.map((d) => d.message).join(", ")
          );
        }

        const externalAccount = await externalAccountsService.create(
          dbUser.id,
          value
        );

        return {
          status: 201,
          response: new APIResponse(
            true,
            "External account created successfully",
            externalAccount
          ),
        };
      }
    );
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;
      const externalAccounts = await externalAccountsService.list(dbUser.id);

      res
        .status(200)
        .json(
          new APIResponse(
            true,
            "External accounts retrieved successfully",
            externalAccounts
          )
        );
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;
      const { error, value } = externalAccountIdSchema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      const externalAccount = await externalAccountsService.getById(
        dbUser.id,
        value.id
      );

      res
        .status(200)
        .json(
          new APIResponse(
            true,
            "External account retrieved successfully",
            externalAccount
          )
        );
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;
      const { error, value } = externalAccountIdSchema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      await externalAccountsService.delete(dbUser.id, value.id);

      res
        .status(200)
        .json(
          new APIResponse(true, "External account deleted successfully", null)
        );
    } catch (error) {
      next(error);
    }
  }
}

export default new ExternalAccountsController();
