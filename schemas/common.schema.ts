import Joi from "joi";

export const firstNameField = Joi.string().trim().min(1).max(100).messages({
  "string.empty": "First name cannot be empty",
  "string.max": "First name cannot exceed 100 characters",
  "any.required": "First name is required",
});

export const lastNameField = Joi.string().trim().min(1).max(100).messages({
  "string.empty": "Last name cannot be empty",
  "string.max": "Last name cannot exceed 100 characters",
  "any.required": "Last name is required",
});

export const emailField = Joi.string().trim().lowercase().email().messages({
  "string.empty": "Email cannot be empty",
  "string.email": "Please provide a valid email address",
  "any.required": "Email is required",
});

export const phoneNumberPrefixField = Joi.string()
  .trim()
  .pattern(/^\+[1-9]\d{0,3}$/)
  .messages({
    "string.empty": "Phone number prefix cannot be empty",
    "string.pattern.base":
      "Phone number prefix must start with + followed by 1-4 digits",
    "any.required": "Phone number prefix is required",
  });

export const phoneNumberField = Joi.string()
  .trim()
  .pattern(/^\d{4,15}$/)
  .messages({
    "string.empty": "Phone number cannot be empty",
    "string.pattern.base": "Phone number must contain 4-15 digits only",
    "any.required": "Phone number is required",
  });

export const dateOfBirthField = Joi.date().iso().max("now").messages({
  "date.base": "Please provide a valid date",
  "date.format": "Date must be in ISO format",
  "date.max": "Date of birth cannot be in the future",
  "any.required": "Date of birth is required",
});

export const nationalityField = Joi.string().trim().valid("US").messages({
  "string.empty": "Nationality cannot be empty",
  "any.only": "Nationality must be US",
});

export const uuidIdParamSchema = (label: string) =>
  Joi.object({
    id: Joi.string().uuid().required().messages({
      "string.base": `${label} must be a string`,
      "string.guid": `${label} must be a valid UUID`,
      "any.required": `${label} is required`,
    }),
  });

export const minOneFieldMessage = {
  "object.min": "At least one field is required to update",
};
