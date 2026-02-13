import Joi from "joi";
import AppError from "../lib/AppError";

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
    kycLink: Joi.string().required(),
    tosLink: Joi.string().required(),
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

// Schema for funding account data
const fundingAccountDataSchema = Joi.object({
  id: Joi.string().required(),
  entityId: Joi.string().required(),
  jurisdictionId: Joi.string().required(),
  providerId: Joi.string().required(),
  status: Joi.string().required(),
  accountInfo: Joi.object({
    currency: Joi.string().required(),
    bank_name: Joi.string().required(),
    bank_address: Joi.string().required(),
    bank_routing_number: Joi.string().required(),
    bank_account_number: Joi.string().required(),
    bank_beneficiary_name: Joi.string().required(),
    bank_beneficiary_address: Joi.string().required(),
    payment_rail: Joi.string().required(),
    payment_rails: Joi.array().items(Joi.string()).required(),
  }).required(),
});

// Schema for create funding account response
export const zynkCreateFundingAccountResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.object({
    message: Joi.string().required(),
    data: fundingAccountDataSchema.required(),
  }).required(),
});

// Schema for get funding account response
export const zynkGetFundingAccountResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: fundingAccountDataSchema.required(),
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
    throw new AppError(
      502,
      `${errorMessage}: Invalid response from Zynk API`
    );
  }

  return value as T;
}
