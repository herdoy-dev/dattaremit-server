import Joi from "joi";
import { NotificationType } from "../generated/prisma/client";
import { uuidIdParamSchema } from "./common.schema";

export const getNotificationsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional().default(20).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 50",
  }),

  offset: Joi.number().integer().min(0).optional().default(0).messages({
    "number.base": "Offset must be a number",
    "number.integer": "Offset must be an integer",
    "number.min": "Offset cannot be negative",
  }),

  isRead: Joi.boolean().optional().messages({
    "boolean.base": "isRead must be a boolean",
  }),
});

export const notificationIdParamSchema = uuidIdParamSchema("Notification ID");

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
};

export type NotificationFilters = {
  limit?: number;
  offset?: number;
  isRead?: boolean;
};
