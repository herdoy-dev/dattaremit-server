import Joi from "joi";

export const sendTransferSchema = Joi.object({
  contactId: Joi.string().uuid().required().messages({
    "string.guid": "Contact ID must be a valid UUID",
    "any.required": "Contact ID is required",
  }),
  amountCents: Joi.number().integer().min(100).max(1000000).required().messages({
    "number.base": "Amount must be a number",
    "number.integer": "Amount must be a whole number (in cents)",
    "number.min": "Minimum transfer amount is $1.00",
    "number.max": "Maximum transfer amount is $10,000.00",
    "any.required": "Amount is required",
  }),
  note: Joi.string().trim().max(255).optional().messages({
    "string.max": "Note cannot exceed 255 characters",
  }),
});

export interface SendTransferInput {
  contactId: string;
  amountCents: number;
  note?: string;
}
