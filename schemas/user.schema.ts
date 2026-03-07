import Joi from "joi";
import type { AccountStatus } from "../generated/prisma/enums";
import {
  firstNameField,
  lastNameField,
  emailField,
  phoneNumberPrefixField,
  phoneNumberField,
  dateOfBirthField,
  nationalityField,
  uuidIdParamSchema,
  minOneFieldMessage,
} from "./common.schema";

export const createUserSchema = Joi.object({
  clerkUserId: Joi.string().trim().min(1).required().messages({
    "string.empty": "Clerk user ID cannot be empty",
    "any.required": "Clerk user ID is required",
  }),
  firstName: firstNameField.required(),
  lastName: lastNameField.required(),
  email: emailField.required(),
  phoneNumberPrefix: phoneNumberPrefixField.required(),
  phoneNumber: phoneNumberField.required(),
  dateOfBirth: dateOfBirthField.required(),
  nationality: nationalityField.optional(),
  referredByCode: Joi.string().trim().optional(),
});

export const updateUserSchema = Joi.object({
  firstName: firstNameField,
  lastName: lastNameField,
  email: emailField,
  phoneNumberPrefix: phoneNumberPrefixField.messages({
    "string.pattern.base":
      "Phone number prefix must start with + followed by 1-4 digits (e.g., +1, +44, +91)",
  }),
  phoneNumber: phoneNumberField,
  dateOfBirth: dateOfBirthField,
  nationality: nationalityField,
})
  .min(1)
  .messages(minOneFieldMessage);

export const userIdParamSchema = uuidIdParamSchema("User ID");

export type CreateUserInput = {
  clerkUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumberPrefix: string;
  phoneNumber: string;
  dateOfBirth: Date;
  nationality?: string;
  referredByCode?: string;
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
  zynkExternalAccountId?: string;
};

export type UserIdParam = {
  id: string;
};
