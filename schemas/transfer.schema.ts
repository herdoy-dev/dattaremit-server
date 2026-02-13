import Joi from "joi";

// ============================================
// Simulate Transfer Schema
// ============================================

// Maximum safe transfer amount to prevent integer overflow (in smallest unit)
// Using Number.MAX_SAFE_INTEGER / 100 to allow for cent precision
const MAX_TRANSFER_AMOUNT = 90071992547409.91;

export const simulateTransferSchema = Joi.object({
  externalAccountId: Joi.string().uuid().required().messages({
    "string.base": "External account ID must be a string",
    "string.guid": "External account ID must be a valid UUID",
    "any.required": "External account ID is required",
  }),

  exactAmountIn: Joi.number().positive().max(MAX_TRANSFER_AMOUNT).optional().messages({
    "number.base": "Exact amount in must be a number",
    "number.positive": "Exact amount in must be positive",
    "number.max": "Exact amount in exceeds maximum allowed value",
  }),

  exactAmountOut: Joi.number().positive().max(MAX_TRANSFER_AMOUNT).optional().messages({
    "number.base": "Exact amount out must be a number",
    "number.positive": "Exact amount out must be positive",
    "number.max": "Exact amount out exceeds maximum allowed value",
  }),

  depositMemo: Joi.string().max(255).optional().messages({
    "string.max": "Deposit memo cannot exceed 255 characters",
  }),
}).or("exactAmountIn", "exactAmountOut").messages({
  "object.missing": "Either exactAmountIn or exactAmountOut is required",
});

// ============================================
// Transfer Schema
// ============================================

export const transferSchema = Joi.object({
  // executionId format: alphanumeric with underscores (e.g., cexec_a8ddf280_ac0b_43c0_bf35_9b3192feb059)
  executionId: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .min(1)
    .max(100)
    .required()
    .messages({
      "string.empty": "Execution ID cannot be empty",
      "string.pattern.base": "Execution ID contains invalid characters",
      "string.max": "Execution ID cannot exceed 100 characters",
      "any.required": "Execution ID is required",
    }),

  signature: Joi.string()
    .pattern(/^[A-Za-z0-9+/=._-]+$/)
    .min(1)
    .max(2048)
    .required()
    .messages({
      "string.empty": "Signature cannot be empty",
      "string.pattern.base": "Signature contains invalid characters",
      "string.max": "Signature cannot exceed 2048 characters",
      "any.required": "Signature is required",
    }),
});

// ============================================
// Type Exports
// ============================================

export type SimulateTransferInput = {
  externalAccountId: string;
  exactAmountIn?: number;
  exactAmountOut?: number;
  depositMemo?: string;
};

export type TransferInput = {
  executionId: string;
  signature: string;
};
