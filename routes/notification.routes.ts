import type { RequestHandler } from "express";
import express from "express";
import notificationController from "../controllers/notification.controller";
import dbUser from "../middlewares/db-user";

const router = express.Router();

router.get("/", dbUser, notificationController.list as RequestHandler);
router.get(
  "/unread-count",
  dbUser,
  notificationController.unreadCount as RequestHandler
);
router.patch(
  "/read-all",
  dbUser,
  notificationController.markAllAsRead as RequestHandler
);
router.patch(
  "/:id/read",
  dbUser,
  notificationController.markAsRead as RequestHandler
);
router.delete(
  "/:id",
  dbUser,
  notificationController.delete as RequestHandler
);

export default router;
