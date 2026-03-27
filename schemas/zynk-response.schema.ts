import Joi from "joi";
import AppError from "../lib/AppError";
import logger from "../lib/logger";

// Schema for entity creation response
export const zynkEntityResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.object({
    message: Joi.string().required(),
    entityId: Joi.string().required(),
  }).required(),
});

// Schema for KYC response
export const zynkKycResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.object({
    message: Joi.string().required(),
    kycLink: Joi.string().optional(),
    tosLink: Joi.string().optional(),
    kycStatus: Joi.string()
      .valid(
        "not_started",
        "initiated",
        "reviewing",
        "additional_info_required",
        "rejected",
        "approved"
      )
      .required(),
  }).required(),
});

// Schema for KYC status response
export const zynkKycStatusResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  message: Joi.string().allow("").optional(),
  data: Joi.object({
    status: Joi.array()
      .items(
        Joi.object({
          routingId: Joi.string().required(),
          supportedRoutes: Joi.array().items(Joi.object()).optional(),
          kycStatus: Joi.string().required(),
          routingEnabled: Joi.boolean().required(),
          kycFees: Joi.object().optional(),
        })
      )
      .required(),
  }).required(),
});

// Schema for add external account response
export const zynkAddExternalAccountResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.object({
    message: Joi.string().required(),
    accountId: Joi.string().required(),
  }).required(),
});

// Schema for enable external account response
export const zynkEnableExternalAccountResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.object({
    message: Joi.string().required(),
  }).required(),
});

// Schema for simulate transaction response
const feeItemSchema = Joi.object({
  amount: Joi.number().required(),
  currency: Joi.string().required(),
});

export const zynkSimulateResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.object({
    executionId: Joi.string().required(),
    quote: Joi.object({
      inAmount: feeItemSchema.required(),
      outAmount: feeItemSchema.required(),
      exchangeRate: Joi.object({
        rate: Joi.number().required(),
        conversion: Joi.string().required(),
      }).required(),
      fees: Joi.object({
        partnerFees: feeItemSchema.required(),
        zynkGasFees: feeItemSchema.required(),
        zynkNetworkFees: feeItemSchema.required(),
        infraProviderFees: feeItemSchema.required(),
        bankingFees: feeItemSchema.required(),
        txFees: feeItemSchema.required(),
        totalFees: feeItemSchema.required(),
      }).required(),
    }).required(),
    validUntil: Joi.string().required(),
    message: Joi.string().required(),
    depositAccount: Joi.object().unknown(true).optional(),
  }).required(),
});

// Schema for transfer response
export const zynkTransferResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.object({
    message: Joi.string().required(),
  }).required(),
});

// Schema for Plaid link token response
export const zynkPlaidLinkTokenResponseSchema = Joi.object({
  plaid_token: Joi.string().required(),
});

/**
 * Validates a Zynk API response against a schema
 * Throws AppError if validation fails
 */
export function validateZynkResponse<T>(
  response: unknown,
  schema: Joi.ObjectSchema,
  errorMessage: string
): T {
  const { error, value } = schema.validate(response, {
    stripUnknown: true,
    abortEarly: false,
  });

  if (error) {
    logger.error("Zynk API response validation failed", {
      errorMessage,
      validationErrors: error.details.map((d) => d.message),
    });
    throw new AppError(
      502,
      `${errorMessage}: Invalid response from Zynk API`
    );
  }

  return value as T;
}
