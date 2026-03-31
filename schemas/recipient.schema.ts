import Joi from "joi";
import {
  firstNameField,
  lastNameField,
  emailField,
  phoneNumberPrefixField,
  phoneNumberField,
  dateOfBirthField,
} from "./common.schema";

export const createRecipientSchema = Joi.object({
  firstName: firstNameField.required(),
  lastName: lastNameField.required(),
  email: emailField.required(),
  phoneNumberPrefix: phoneNumberPrefixField.required(),
  phoneNumber: phoneNumberField.required(),
  dateOfBirth: dateOfBirthField.required(),
  addressLine1: Joi.string().trim().min(1).max(255).required().messages({
    "string.empty": "Address line 1 cannot be empty",
    "any.required": "Address line 1 is required",
  }),
  addressLine2: Joi.string().trim().max(255).optional().allow(""),
  city: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "City cannot be empty",
    "any.required": "City is required",
  }),
  state: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "State cannot be empty",
    "any.required": "State is required",
  }),
  postalCode: Joi.string().trim().min(1).max(20).required().messages({
    "string.empty": "Postal code cannot be empty",
    "any.required": "Postal code is required",
  }),
});

export interface CreateRecipientInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumberPrefix: string;
  phoneNumber: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
}

export const addRecipientBankSchema = Joi.object({
  bankName: Joi.string().trim().min(1).required().messages({
    "string.empty": "Bank name cannot be empty",
    "any.required": "Bank name is required",
  }),
  accountName: Joi.string().trim().min(1).required().messages({
    "string.empty": "Account holder name cannot be empty",
    "any.required": "Account holder name is required",
  }),
  accountNumber: Joi.string().trim().min(1).required().messages({
    "string.empty": "Account number cannot be empty",
    "any.required": "Account number is required",
  }),
  ifsc: Joi.string()
    .trim()
    .pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .required()
    .messages({
      "string.pattern.base":
        "IFSC must be in valid format (e.g. SBIN0001234)",
      "any.required": "IFSC code is required",
    }),
  branchName: Joi.string().trim().min(1).required().messages({
    "string.empty": "Branch name cannot be empty",
    "any.required": "Branch name is required",
  }),
  bankAccountType: Joi.string().valid("SAVINGS", "CURRENT").required().messages({
    "any.only": "Account type must be SAVINGS or CURRENT",
    "any.required": "Account type is required",
  }),
  phoneNumber: Joi.string().trim().min(1).required().messages({
    "string.empty": "Phone number cannot be empty",
    "any.required": "Phone number is required",
  }),
});

export interface AddRecipientBankInput {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  branchName: string;
  bankAccountType: string;
  phoneNumber: string;
}
