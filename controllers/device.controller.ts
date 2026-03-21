import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import deviceService from "../services/device.service";
import {
  registerDeviceSchema,
  deviceIdParamSchema,
} from "../schemas/device.schema";

class DeviceController {
  register = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const value = validate(registerDeviceSchema, req.body);

    const device = await deviceService.register(user.id, value);

    res
      .status(200)
      .json(new APIResponse(true, "Device registered successfully", device));
  });

  unregister = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const { id } = validate(deviceIdParamSchema, req.params);

    await deviceService.unregister(id, user.id);

    res
      .status(200)
      .json(new APIResponse(true, "Device unregistered successfully"));
  });
}

export default new DeviceController();
