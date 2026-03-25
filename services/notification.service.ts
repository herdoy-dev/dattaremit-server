import * as Sentry from "@sentry/node";
import AppError from "../lib/AppError";
import logger from "../lib/logger";
import notificationRepository from "../repositories/notification.repository";
import pushService from "./push.service";
import type {
  CreateNotificationInput,
  NotificationFilters,
} from "../schemas/notification.schema";

class NotificationService {
  async create(data: CreateNotificationInput) {
    return Sentry.startSpan(
      { name: "notification.create", op: "notification", attributes: { "notification.type": data.type } },
      async () => {
        const notification = await notificationRepository.create(data);

        // Fire-and-forget push delivery
        pushService
          .sendToUser(data.userId, {
            title: data.title,
            body: data.body,
            data: { type: data.type, notificationId: notification.id },
          })
          .catch((err) => {
            logger.warn("Push delivery failed (fire-and-forget)", {
              error: err instanceof Error ? err.message : String(err),
              userId: data.userId,
              notificationId: notification.id,
            });
          });

        return notification;
      },
    );
  }

  async getByUserId(userId: string, filters: NotificationFilters) {
    return notificationRepository.findByUserId(userId, filters);
  }

  async getUnreadCount(userId: string) {
    return notificationRepository.getUnreadCount(userId);
  }

  async markAsRead(id: string, userId: string) {
    try {
      return await notificationRepository.markAsRead(id, userId);
    } catch (error) {
      if ((error as any)?.code === "P2025") {
        throw new AppError(404, "Notification not found.");
      }
      throw error;
    }
  }

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  }

  async delete(id: string, userId: string) {
    try {
      return await notificationRepository.deleteByIdAndUserId(id, userId);
    } catch (error) {
      if ((error as any)?.code === "P2025") {
        throw new AppError(404, "Notification not found.");
      }
      throw error;
    }
  }
}

export default new NotificationService();
