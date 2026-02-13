import Joi from "joi";

export const createContactSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Name cannot be empty",
    "string.max": "Name cannot exceed 100 characters",
    "any.required": "Name is required",
  }),

  email: Joi.string().trim().email().required().messages({
    "string.email": "Must be a valid email address",
    "any.required": "Email is required",
  }),

  message: Joi.string().trim().min(1).max(2000).required().messages({
    "string.empty": "Message cannot be empty",
    "string.max": "Message cannot exceed 2000 characters",
    "any.required": "Message is required",
  }),
});

export type CreateContactInput = {
  name: string;
  email: string;
  message: string;
};
