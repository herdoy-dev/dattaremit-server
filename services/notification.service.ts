import AppError from "../lib/AppError";
import notificationRepository from "../repositories/notification.repository";
import pushService from "./push.service";
import type {
  CreateNotificationInput,
  NotificationFilters,
} from "../schemas/notification.schema";

class NotificationService {
  async create(data: CreateNotificationInput) {
    const notification = await notificationRepository.create(data);

    // Fire-and-forget push delivery
    pushService
      .sendToUser(data.userId, {
        title: data.title,
        body: data.body,
        data: { type: data.type, notificationId: notification.id },
      })
      .catch(() => {});

    return notification;
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
    } catch {
      throw new AppError(404, "Notification not found");
    }
  }

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  }

  async delete(id: string, userId: string) {
    try {
      return await notificationRepository.deleteByIdAndUserId(id, userId);
    } catch {
      throw new AppError(404, "Notification not found");
    }
  }
}

export default new NotificationService();
