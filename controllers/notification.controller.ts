import type { Response } from "express";
import APIResponse from "../lib/APIResponse";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import type { AuthRequest } from "../middlewares/auth";
import notificationService from "../services/notification.service";
import {
  getNotificationsQuerySchema,
  notificationIdParamSchema,
} from "../schemas/notification.schema";

class NotificationController {
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const value = validate(getNotificationsQuerySchema, req.query);

    const result = await notificationService.getByUserId(user.id, value);

    res.status(200).json(
      new APIResponse(true, "Notifications retrieved successfully", {
        items: result.items,
        total: result.total,
        limit: value.limit ?? 20,
        offset: value.offset ?? 0,
      })
    );
  });

  unreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const count = await notificationService.getUnreadCount(user.id);

    res
      .status(200)
      .json(
        new APIResponse(true, "Unread count retrieved successfully", { count })
      );
  });

  markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const { id } = validate(notificationIdParamSchema, req.params);

    const notification = await notificationService.markAsRead(id, user.id);

    res
      .status(200)
      .json(
        new APIResponse(true, "Notification marked as read", notification)
      );
  });

  markAllAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    await notificationService.markAllAsRead(user.id);

    res
      .status(200)
      .json(new APIResponse(true, "All notifications marked as read"));
  });

  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const { id } = validate(notificationIdParamSchema, req.params);

    await notificationService.delete(id, user.id);

    res
      .status(200)
      .json(new APIResponse(true, "Notification deleted successfully"));
  });
}

export default new NotificationController();
