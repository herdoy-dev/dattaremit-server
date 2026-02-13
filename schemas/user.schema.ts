import Joi from "joi";
import type { AccountStatus } from "../generated/prisma/enums";

export const createUserSchema = Joi.object({
  clerkUserId: Joi.string().trim().min(1).required().messages({
    "string.empty": "Clerk user ID cannot be empty",
    "any.required": "Clerk user ID is required",
  }),

  firstName: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "First name cannot be empty",
    "string.max": "First name cannot exceed 100 characters",
    "any.required": "First name is required",
  }),

  lastName: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Last name cannot be empty",
    "string.max": "Last name cannot exceed 100 characters",
    "any.required": "Last name is required",
  }),

  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email cannot be empty",
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),

  phoneNumberPrefix: Joi.string()
    .trim()
    .pattern(/^\+[1-9]\d{0,3}$/)
    .required()
    .messages({
      "string.empty": "Phone number prefix cannot be empty",
      "string.pattern.base":
        "Phone number prefix must start with + followed by 1-4 digits",
      "any.required": "Phone number prefix is required",
    }),

  phoneNumber: Joi.string()
    .trim()
    .pattern(/^\d{4,15}$/)
    .required()
    .messages({
      "string.empty": "Phone number cannot be empty",
      "string.pattern.base": "Phone number must contain 4-15 digits only",
      "any.required": "Phone number is required",
    }),

  dateOfBirth: Joi.date().iso().max("now").required().messages({
    "date.base": "Please provide a valid date",
    "date.format": "Date must be in ISO format",
    "date.max": "Date of birth cannot be in the future",
    "any.required": "Date of birth is required",
  }),
});

export const updateUserSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(100).messages({
    "string.empty": "First name cannot be empty",
    "string.max": "First name cannot exceed 100 characters",
  }),

  lastName: Joi.string().trim().min(1).max(100).messages({
    "string.empty": "Last name cannot be empty",
    "string.max": "Last name cannot exceed 100 characters",
  }),

  email: Joi.string().trim().lowercase().email().messages({
    "string.empty": "Email cannot be empty",
    "string.email": "Please provide a valid email address",
  }),

  phoneNumberPrefix: Joi.string()
    .trim()
    .pattern(/^\+[1-9]\d{0,3}$/)
    .messages({
      "string.empty": "Phone number prefix cannot be empty",
      "string.pattern.base":
        "Phone number prefix must start with + followed by 1-4 digits (e.g., +1, +44, +91)",
    }),

  phoneNumber: Joi.string()
    .trim()
    .pattern(/^\d{4,15}$/)
    .messages({
      "string.empty": "Phone number cannot be empty",
      "string.pattern.base": "Phone number must contain 4-15 digits only",
    }),

  dateOfBirth: Joi.date().iso().max("now").messages({
    "date.base": "Please provide a valid date",
    "date.format": "Date must be in ISO format",
    "date.max": "Date of birth cannot be in the future",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update",
  });

export const userIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    "string.base": "User ID must be a string",
    "string.guid": "User ID must be a valid UUID",
    "any.required": "User ID is required",
  }),
});

export type CreateUserInput = {
  clerkUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumberPrefix: string;
  phoneNumber: string;
  dateOfBirth: Date;
};

// Auth-critical fields that should NEVER be updatable via public API
type AuthCriticalFields = "clerkUserId";

// Public API type - explicitly excludes auth-critical fields that could allow account takeover
export type UpdateUserInput = Partial<
  Omit<CreateUserInput, AuthCriticalFields>
>;

// Internal type for server-side updates (includes all fields for internal use only)
export type InternalUpdateUserInput = Partial<CreateUserInput> & {
  zynkEntityId?: string;
  accountStatus?: AccountStatus;
  zynkFundingAccountId?: string;
};

export type UserIdParam = {
  id: string;
};
