import Joi from "joi";

export const kycEventSchema = Joi.object({
  eventCategory: Joi.string().valid("kyc", "transfer").required().messages({
    "any.only": "Event category must be 'kyc' or 'transfer'",
    "any.required": "Event category is required",
  }),

  eventType: Joi.string().required().messages({
    "any.required": "Event type is required",
  }),

  eventStatus: Joi.string().required().messages({
    "any.required": "Event status is required",
  }),

  eventObject: Joi.object({
    entityId: Joi.string().required().messages({
      "any.required": "Entity ID is required",
    }),

    routingId: Joi.string().allow("").optional(),

    status: Joi.string().required().messages({
      "any.required": "Status is required",
    }),

    routingEnabled: Joi.boolean().optional(),
  })
    .required()
    .messages({
      "any.required": "Event object is required",
    }),
});

export type KYCEvent = {
  eventCategory: "kyc" | "transfer";
  eventType: string;
  eventStatus: string;
  eventObject: {
    entityId: string;
    routingId?: string;
    status: string;
    routingEnabled?: boolean;
  };
};
