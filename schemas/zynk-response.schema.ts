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
