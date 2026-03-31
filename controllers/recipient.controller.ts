import type { Response, NextFunction } from "express";
import Joi from "joi";
import APIResponse from "../lib/APIResponse";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import {
  withIdempotency,
  type IdempotentHandlerResult,
} from "../lib/idempotency";
import type { AuthRequest } from "../middlewares/auth";
import recipientService from "../services/recipient.service";
import { createRecipientSchema, addRecipientBankSchema } from "../schemas/recipient.schema";
import { uuidIdParamSchema } from "../schemas/common.schema";

class RecipientController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "recipient:create" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const value = validate(createRecipientSchema, req.body);
        const recipient = await recipientService.createRecipient(req.user.id, value);
        return {
          status: 201,
          response: new APIResponse(true, "Recipient added and KYC initiated", recipient),
        };
      },
    );
  }

  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const recipients = await recipientService.getRecipients(req.user.id);
    res
      .status(200)
      .json(new APIResponse(true, "Recipients retrieved successfully", recipients));
  });

  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = validate(uuidIdParamSchema("Recipient ID"), req.params);
    const recipient = await recipientService.getRecipient(req.user.id, id);
    res
      .status(200)
      .json(new APIResponse(true, "Recipient retrieved successfully", recipient));
  });

  async addBank(req: AuthRequest, res: Response, next: NextFunction) {
    return withIdempotency(
      req,
      res,
      next,
      { operation: "recipient:addBank" },
      async (): Promise<IdempotentHandlerResult<unknown>> => {
        const { id } = validate(uuidIdParamSchema("Recipient ID"), req.params);
        const value = validate(addRecipientBankSchema, req.body);
        const recipient = await recipientService.addBankAccount(req.user.id, id, value);
        return {
          status: 201,
          response: new APIResponse(true, "Bank account added successfully", recipient),
        };
      },
    );
  }

  resendKyc = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = validate(uuidIdParamSchema("Recipient ID"), req.params);
    await recipientService.resendKycEmail(req.user.id, id);
    res
      .status(200)
      .json(new APIResponse(true, "KYC email resent successfully"));
  });
}

export default new RecipientController();
