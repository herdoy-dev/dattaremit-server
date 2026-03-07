import Joi from "joi";
import { ActivityStatus, ActivityType } from "../generated/prisma/client";
import { uuidIdParamSchema, minOneFieldMessage } from "./common.schema";

export const getActivitiesQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(ActivityStatus))
    .optional()
    .messages({
      "any.only": "Status must be a valid activity status",
    }),

  type: Joi.string()
    .valid(...Object.values(ActivityType))
    .optional()
    .messages({
      "any.only": "Type must be a valid activity type",
    }),

  referenceId: Joi.string().uuid().optional().messages({
    "string.guid": "Reference ID must be a valid UUID",
  }),

  from: Joi.date().iso().optional().messages({
    "date.format": "From must be a valid ISO date",
  }),

  to: Joi.date().iso().optional().messages({
    "date.format": "To must be a valid ISO date",
  }),

  limit: Joi.number().integer().min(1).max(100).optional().default(20).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  offset: Joi.number().integer().min(0).optional().default(0).messages({
    "number.base": "Offset must be a number",
    "number.integer": "Offset must be an integer",
    "number.min": "Offset cannot be negative",
  }),
}).with("from", "to");

export const createActivitySchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    "string.base": "User ID must be a string",
    "string.guid": "User ID must be a valid UUID",
    "any.required": "User ID is required",
  }),

  type: Joi.string()
    .valid(...Object.values(ActivityType))
    .required()
    .messages({
      "any.only": "Type must be a valid activity type",
      "any.required": "Type is required",
    }),

  status: Joi.string()
    .valid(...Object.values(ActivityStatus))
    .optional()
    .messages({
      "any.only": "Status must be a valid activity status",
    }),

  description: Joi.string().max(500).allow("", null).optional().messages({
    "string.max": "Description cannot exceed 500 characters",
  }),

  amount: Joi.number().precision(6).allow(null).optional().messages({
    "number.base": "Amount must be a number",
  }),

  metadata: Joi.object().allow(null).optional(),

  referenceId: Joi.string().uuid().allow(null).optional().messages({
    "string.guid": "Reference ID must be a valid UUID",
  }),

  ipAddress: Joi.string().max(45).allow("", null).optional().messages({
    "string.max": "IP address cannot exceed 45 characters",
  }),
});

export const updateActivitySchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(ActivityStatus))
    .messages({
      "any.only": "Status must be a valid activity status",
    }),

  description: Joi.string().max(500).allow("", null).messages({
    "string.max": "Description cannot exceed 500 characters",
  }),

  amount: Joi.number().precision(6).allow(null).messages({
    "number.base": "Amount must be a number",
  }),

  metadata: Joi.object().allow(null),

  referenceId: Joi.string().uuid().allow(null).messages({
    "string.guid": "Reference ID must be a valid UUID",
  }),

  ipAddress: Joi.string().max(45).allow("", null).messages({
    "string.max": "IP address cannot exceed 45 characters",
  }),
})
  .min(1)
  .messages(minOneFieldMessage);

export const activityIdParamSchema = uuidIdParamSchema("Activity ID");

export type CreateActivityInput = {
  userId: string;
  type: ActivityType;
  status?: ActivityStatus;
  description?: string | null;
  amount?: number | null;
  metadata?: Record<string, unknown> | null;
  referenceId?: string | null;
  ipAddress?: string | null;
};

export type UpdateActivityInput = Partial<Omit<CreateActivityInput, "userId" | "type">>;

export type ActivityIdParam = {
  id: string;
};

export type GetActivitiesQuery = {
  status?: ActivityStatus;
  type?: ActivityType;
  referenceId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};
