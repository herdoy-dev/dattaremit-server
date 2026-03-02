import Joi from "joi";
import { AccountStatus, UserRole } from "../generated/prisma/client";

export const adminCreateUserSchema = Joi.object({
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

  nationality: Joi.string().trim().valid("US", "IN").optional().messages({
    "string.empty": "Nationality cannot be empty",
    "any.only": "Nationality must be US or IN",
  }),

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

  nationality: Joi.string().trim().valid("US", "IN").optional().messages({
    "string.empty": "Nationality cannot be empty",
    "any.only": "Nationality must be US or IN",
  }),

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
        "Phone number prefix must start with + followed by 1-4 digits",
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

  nationality: Joi.string().trim().valid("US", "IN").messages({
    "string.empty": "Nationality cannot be empty",
    "any.only": "Nationality must be US or IN",
  }),

  role: Joi.string()
    .valid(...Object.values(UserRole))
    .messages({
      "any.only": `Role must be one of ${Object.values(UserRole).join(", ")}`,
    }),

  accountStatus: Joi.string()
    .valid(...Object.values(AccountStatus))
    .messages({
      "any.only": "Account status must be a valid status",
    }),

  referValue: Joi.number().integer().min(1).messages({
    "number.base": "Refer value must be a number",
    "number.integer": "Refer value must be an integer",
    "number.min": "Refer value must be at least 1",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update",
  });

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
  role?: "ADMIN" | "USER" | "INFLUENCER" | "PROMOTER";
  accountStatus?: "INITIAL" | "ACTIVE" | "PENDING" | "REJECTED";
  referValue?: number;
};

export type ChangeRoleInput = {
  role: "ADMIN" | "USER" | "INFLUENCER" | "PROMOTER";
};
