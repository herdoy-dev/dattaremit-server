import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import {
  withIdempotency,
  type IdempotentHandlerResult,
} from "../lib/idempotency";
import type { AuthRequest } from "../middlewares/auth";
import transferService from "../services/transfer.service";
import {
  simulateTransferSchema,
  transferSchema,
} from "../schemas/transfer.schema";

class TransferController {
  async simulateTransfer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { error, value } = simulateTransferSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      const result = await transferService.simulateTransfer(user.id, value);

      res
        .status(200)
        .json(new APIResponse(true, "Transfer simulation successful", result));
    } catch (error) {
      next(error);
    }
  }

  async transfer(req: AuthRequest, res: Response, next: NextFunction) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "transfer:execute" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const user = req.user;
        const { error, value } = transferSchema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
        });

        if (error) {
          throw new AppError(400, error.details.map((d) => d.message).join(", "));
        }

        const result = await transferService.transfer(user.id, value);

        return {
          status: 200,
          response: new APIResponse(true, result.message, {
            executionId: result.executionId,
          }),
        };
      }
    );
  }
}

export default new TransferController();
