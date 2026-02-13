import Joi from "joi";

// ============================================
// Session Schemas
// ============================================

export const verifySessionSchema = Joi.object({
  otpId: Joi.string().min(1).required().messages({
    "string.empty": "OTP ID cannot be empty",
    "any.required": "OTP ID is required",
  }),

  otpCode: Joi.string().required().messages({
    "string.empty": "OTP code cannot be empty",
    "any.required": "OTP code is required",
  }),
});

// ============================================
// Wallet Schemas
// ============================================

export const submitWalletSchema = Joi.object({
  payloadId: Joi.string().required().messages({
    "string.empty": "Payload ID cannot be empty",
    "any.required": "Payload ID is required",
  }),
  signature: Joi.string().required().messages({
    "string.empty": "Signature cannot be empty",
    "any.required": "Signature is required",
  }),
});

// ============================================
// Transaction Query Schemas
// ============================================

export const getTransactionsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional().default(20).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  offset: Joi.number().integer().min(0).optional().default(0).messages({
    "number.base": "Offset must be a number",
    "number.integer": "Offset must be an integer",
    "number.min": "Offset cannot be negative",
  }),
});

// ============================================
// Type Exports
// ============================================


export type CreateWalletInput = {
  walletName?: string;
};

export type GetTransactionsQuery = {
  limit?: number;
  offset?: number;
};
