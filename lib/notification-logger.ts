import notificationService from "../services/notification.service";
import type { CreateNotificationInput } from "../schemas/notification.schema";
import logger from "./logger";

type NotifyResult = { id?: string };

async function notify(data: CreateNotificationInput): Promise<NotifyResult> {
  try {
    const notification = await notificationService.create(data);
    return { id: notification.id };
  } catch (error) {
    logger.warn("Failed to create notification", {
      error: error instanceof Error ? error.message : String(error),
      notificationType: data.type,
      userId: data.userId,
    });
    return {};
  }
}

export default { notify };
