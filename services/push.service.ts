import * as Sentry from "@sentry/node";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import expoClient from "../lib/expo-client";
import logger from "../lib/logger";
import deviceRepository from "../repositories/device.repository";

class PushService {
  async sendToUser(
    userId: string,
    notification: { title: string; body: string; data?: Record<string, unknown> }
  ) {
    return Sentry.startSpan(
      { name: "push.sendToUser", op: "push", attributes: { "push.user_id": userId } },
      async (span) => {
        try {
          const devices = await deviceRepository.findByUserId(userId);
          if (devices.length === 0) return;

          span.setAttribute("push.device_count", devices.length);

          const validTokens = devices
            .map((d) => d.expoPushToken)
            .filter((token) => Expo.isExpoPushToken(token));

          if (validTokens.length === 0) return;

          span.setAttribute("push.valid_token_count", validTokens.length);

          const messages: ExpoPushMessage[] = validTokens.map((token) => ({
            to: token,
            sound: "default" as const,
            title: notification.title,
            body: notification.body,
            data: notification.data ?? {},
          }));

          const chunks = expoClient.chunkPushNotifications(messages);

          for (const chunk of chunks) {
            const ticketChunk =
              await expoClient.sendPushNotificationsAsync(chunk);

            ticketChunk.forEach((ticket, index) => {
              if (
                ticket.status === "error" &&
                ticket.details?.error === "DeviceNotRegistered"
              ) {
                const targetToken = chunk[index]?.to;
                if (!targetToken || Array.isArray(targetToken)) return;

                deviceRepository
                  .deleteByToken(targetToken)
                  .catch((err) => {
                    logger.warn("Failed to delete unregistered device token", {
                      error: err instanceof Error ? err.message : String(err),
                    });
                  });
              }
            });
          }
        } catch (error) {
          logger.warn("Push notification delivery failed", {
            error: error instanceof Error ? error.message : String(error),
            userId,
          });
          Sentry.captureException(error, { level: "warning" });
        }
      }
    );
  }
}

export default new PushService();
