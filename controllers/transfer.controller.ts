import type { Response, NextFunction } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import {
  withIdempotency,
  type IdempotentHandlerResult,
} from "../lib/idempotency";
import type { AuthRequest } from "../middlewares/auth";
import { sendTransferSchema } from "../schemas/transfer.schema";
import transferService from "../services/transfer.service";
import userRepository from "../repositories/user.repository";

class TransferController {
  getReceiveInfo = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;

    if (!user.zynkDepositAccountId) {
      throw new AppError(400, "No deposit account linked. Please add your bank account first.");
    }

    res.status(200).json(
      new APIResponse(true, "Receive info retrieved successfully", {
        accountId: user.zynkDepositAccountId,
        email: user.email,
        phone: `${user.phoneNumberPrefix}${user.phoneNumber}`,
        name: `${user.firstName} ${user.lastName}`.trim(),
      }),
    );
  });

  async send(req: AuthRequest, res: Response, next: NextFunction) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "transfer:send" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const { contactId, amountCents, note } = validate(
          sendTransferSchema,
          req.body,
        );

        const amount = amountCents / 100;

        // Look up receiver
        const receiver = await userRepository.findById(contactId);
        if (!receiver) {
          throw new AppError(404, "Recipient not found");
        }

        const result = await transferService.sendMoney(
          req.user.id,
          receiver.id,
          amount,
          note,
        );

        return {
          status: 201,
          response: new APIResponse(true, "Transfer initiated successfully", result),
        };
      },
    );
  }
}

export default new TransferController();
