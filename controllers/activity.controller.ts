import type { NextFunction, Response } from "express";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import type { AuthRequest } from "../middlewares/auth";
import activityService from "../services/activity.service";
import {
  activityIdParamSchema,
  getActivitiesQuerySchema,
} from "../schemas/activity.schema";

class ActivityController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      const { error, value } = getActivitiesQuerySchema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      const result = await activityService.getActivities(user.id, value);

      res.status(200).json(
        new APIResponse(true, "Activities retrieved successfully", {
          items: result.items,
          total: result.total,
          limit: value.limit ?? 20,
          offset: value.offset ?? 0,
        })
      );
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbUser = req.user;
      const { error, value } = activityIdParamSchema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        throw new AppError(400, error.details.map((d) => d.message).join(", "));
      }

      const activity = await activityService.getById(value.id);

      if (activity.userId !== dbUser.id) {
        throw new AppError(403, "You are not authorized to view this activity");
      }

      res
        .status(200)
        .json(
          new APIResponse(true, "Activity retrieved successfully", activity)
        );
    } catch (error) {
      next(error);
    }
  }
}

export default new ActivityController();
