import Joi from "joi";
import { DevicePlatform } from "../generated/prisma/client";
import { uuidIdParamSchema } from "./common.schema";

export const registerDeviceSchema = Joi.object({
  expoPushToken: Joi.string()
    .pattern(/^ExponentPushToken\[.+\]$/)
    .required()
    .messages({
      "string.base": "Expo push token must be a string",
      "string.pattern.base":
        "Expo push token must be in format ExponentPushToken[...]",
      "any.required": "Expo push token is required",
    }),

  platform: Joi.string()
    .valid(...Object.values(DevicePlatform))
    .required()
    .messages({
      "any.only": "Platform must be IOS or ANDROID",
      "any.required": "Platform is required",
    }),

  deviceName: Joi.string().max(255).optional().messages({
    "string.max": "Device name cannot exceed 255 characters",
  }),
});

export const deviceIdParamSchema = uuidIdParamSchema("Device ID");

export type RegisterDeviceInput = {
  expoPushToken: string;
  platform: DevicePlatform;
  deviceName?: string;
};
