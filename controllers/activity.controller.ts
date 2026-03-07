import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import activityService from "../services/activity.service";
import {
  activityIdParamSchema,
  getActivitiesQuerySchema,
} from "../schemas/activity.schema";

class ActivityController {
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const value = validate(getActivitiesQuerySchema, req.query);

    const result = await activityService.getActivities(user.id, value);

    res.status(200).json(
      new APIResponse(true, "Activities retrieved successfully", {
        items: result.items,
        total: result.total,
        limit: value.limit ?? 20,
        offset: value.offset ?? 0,
      })
    );
  });

  getById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const dbUser = req.user;
    const value = validate(activityIdParamSchema, req.params);

    const activity = await activityService.getById(value.id);

    if (activity.userId !== dbUser.id) {
      throw new AppError(404, "Activity not found");
    }

    res
      .status(200)
      .json(
        new APIResponse(true, "Activity retrieved successfully", activity)
      );
  });
}

export default new ActivityController();
