import Joi from "joi";
import { AccountStatus, UserRole } from "../generated/prisma/client";
import {
  firstNameField,
  lastNameField,
  emailField,
  phoneNumberPrefixField,
  phoneNumberField,
  dateOfBirthField,
  nationalityField,
  minOneFieldMessage,
} from "./common.schema";

export const adminCreateUserSchema = Joi.object({
  firstName: firstNameField.required(),
  lastName: lastNameField.required(),
  email: emailField.required(),
  phoneNumberPrefix: phoneNumberPrefixField.required(),
  phoneNumber: phoneNumberField.required(),
  dateOfBirth: dateOfBirthField.required(),
  nationality: nationalityField.optional(),

  role: Joi.string()
    .valid(...Object.values(UserRole))
    .optional()
    .default("USER")
    .messages({
      "any.only": `Role must be one of ${Object.values(UserRole).join(", ")}`,
    }),

  accountStatus: Joi.string()
    .valid(...Object.values(AccountStatus))
    .optional()
    .default("INITIAL")
    .messages({
      "any.only": "Account status must be a valid status",
    }),
});

export const adminCreatePromoterSchema = Joi.object({
  firstName: firstNameField.required(),
  lastName: lastNameField.required(),
  email: emailField.required(),
  phoneNumberPrefix: phoneNumberPrefixField.required(),
  phoneNumber: phoneNumberField.required(),
  dateOfBirth: dateOfBirthField.required(),
  nationality: nationalityField.optional(),

  role: Joi.string()
    .valid("INFLUENCER", "PROMOTER")
    .required()
    .messages({
      "any.only": "Role must be INFLUENCER or PROMOTER",
      "any.required": "Role is required",
    }),

  referValue: Joi.number().integer().min(1).required().messages({
    "number.base": "Refer value must be a number",
    "number.integer": "Refer value must be an integer",
    "number.min": "Refer value must be at least 1",
    "any.required": "Refer value is required",
  }),

  accountStatus: Joi.string()
    .valid(...Object.values(AccountStatus))
    .optional()
    .default("ACTIVE")
    .messages({
      "any.only": "Account status must be a valid status",
    }),
});

export const adminUpdateUserSchema = Joi.object({
  firstName: firstNameField,
  lastName: lastNameField,
  email: emailField,
  phoneNumberPrefix: phoneNumberPrefixField,
  phoneNumber: phoneNumberField,
  dateOfBirth: dateOfBirthField,
  nationality: nationalityField,

  referValue: Joi.number().integer().min(1).messages({
    "number.base": "Refer value must be a number",
    "number.integer": "Refer value must be an integer",
    "number.min": "Refer value must be at least 1",
  }),
})
  .min(1)
  .messages(minOneFieldMessage);

export const changeRoleSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required()
    .messages({
      "any.only": `Role must be one of ${Object.values(UserRole).join(", ")}`,
      "any.required": "Role is required",
    }),
});

export type AdminCreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumberPrefix: string;
  phoneNumber: string;
  dateOfBirth: Date;
  nationality?: string;
  role?: "ADMIN" | "USER" | "INFLUENCER" | "PROMOTER";
  accountStatus?: "INITIAL" | "ACTIVE" | "PENDING" | "REJECTED";
  referValue?: number;
};

export type AdminCreatePromoterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumberPrefix: string;
  phoneNumber: string;
  dateOfBirth: Date;
  nationality?: string;
  role: "INFLUENCER" | "PROMOTER";
  referValue: number;
  accountStatus?: "INITIAL" | "ACTIVE" | "PENDING" | "REJECTED";
};

export type AdminUpdateUserInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumberPrefix?: string;
  phoneNumber?: string;
  dateOfBirth?: Date;
  nationality?: string;
  referValue?: number;
};

export type ChangeRoleInput = {
  role: "ADMIN" | "USER" | "INFLUENCER" | "PROMOTER";
};
