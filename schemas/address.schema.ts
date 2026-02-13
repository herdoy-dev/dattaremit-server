import Joi from "joi";

const VALID_ADDRESS_TYPES = ["PRESENT", "PERMANENT"];

export const createAddressSchema = Joi.object({
  type: Joi.string()
    .valid(...VALID_ADDRESS_TYPES)
    .required()
    .messages({
      "any.only": "Address type must be PRESENT or PERMANENT",
      "any.required": "Address type is required",
    }),

  addressLine1: Joi.string().trim().min(1).max(255).required().messages({
    "string.empty": "Address line 1 cannot be empty",
    "string.max": "Address line 1 cannot exceed 255 characters",
    "any.required": "Address line 1 is required",
  }),

  addressLine2: Joi.string().trim().max(255).allow("").optional().messages({
    "string.max": "Address line 2 cannot exceed 255 characters",
  }),

  city: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "City cannot be empty",
    "string.max": "City cannot exceed 100 characters",
    "any.required": "City is required",
  }),

  state: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "State cannot be empty",
    "string.max": "State cannot exceed 100 characters",
    "any.required": "State is required",
  }),

  country: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Country cannot be empty",
    "string.max": "Country cannot exceed 100 characters",
    "any.required": "Country is required",
  }),

  postalCode: Joi.string().trim().min(1).max(20).required().messages({
    "string.empty": "Postal code cannot be empty",
    "string.max": "Postal code cannot exceed 20 characters",
    "any.required": "Postal code is required",
  }),

  isDefault: Joi.boolean().optional().default(false),

  userId: Joi.string().uuid().required().messages({
    "string.base": "User ID must be a string",
    "string.guid": "User ID must be a valid UUID",
    "any.required": "User ID is required",
  }),
});

export const updateAddressSchema = Joi.object({
  type: Joi.string()
    .valid(...VALID_ADDRESS_TYPES)
    .messages({
      "any.only": "Address type must be PRESENT or PERMANENT",
    }),

  addressLine1: Joi.string().trim().min(1).max(255).messages({
    "string.empty": "Address line 1 cannot be empty",
    "string.max": "Address line 1 cannot exceed 255 characters",
  }),

  addressLine2: Joi.string().trim().max(255).allow("", null).messages({
    "string.max": "Address line 2 cannot exceed 255 characters",
  }),

  city: Joi.string().trim().min(1).max(100).messages({
    "string.empty": "City cannot be empty",
    "string.max": "City cannot exceed 100 characters",
  }),

  state: Joi.string().trim().min(1).max(100).messages({
    "string.empty": "State cannot be empty",
    "string.max": "State cannot exceed 100 characters",
  }),

  country: Joi.string().trim().min(1).max(100).messages({
    "string.empty": "Country cannot be empty",
    "string.max": "Country cannot exceed 100 characters",
  }),

  postalCode: Joi.string().trim().min(1).max(20).messages({
    "string.empty": "Postal code cannot be empty",
    "string.max": "Postal code cannot exceed 20 characters",
  }),

  isDefault: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update",
  });

export const addressIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.base": "Address ID must be a string",
    "string.guid": "Address ID must be a valid UUID",
    "any.required": "Address ID is required",
  }),
});

export type CreateAddressInput = {
  type: "PRESENT" | "PERMANENT";
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault?: boolean;
  userId: string;
};

export type UpdateAddressInput = Partial<
  Omit<CreateAddressInput, "userId">
>;

export type AddressIdParam = {
  id: string;
};
