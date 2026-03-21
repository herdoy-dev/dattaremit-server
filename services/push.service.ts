import * as Sentry from "@sentry/node";
import { Expo } from "expo-server-sdk";
import expoClient from "../lib/expo-client";
import logger from "../lib/logger";
import deviceRepository from "../repositories/device.repository";

class PushService {
  async sendToUser(
    userId: string,
    notification: { title: string; body: string; data?: object }
  ) {
    return Sentry.startSpan(
      { name: "push.sendToUser", op: "push" },
      async () => {
        try {
          const devices = await deviceRepository.findByUserId(userId);
          if (devices.length === 0) return;

          const validTokens = devices
            .map((d) => d.expoPushToken)
            .filter((token) => Expo.isExpoPushToken(token));

          if (validTokens.length === 0) return;

          const messages = validTokens.map((token) => ({
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
                deviceRepository
                  .deleteByToken(messages[index].to as string)
                  .catch(() => {});
              }
            });
          }
        } catch (error) {
          logger.warn("Push notification delivery failed", {
            error: error instanceof Error ? error.message : String(error),
            userId,
          });
        }
      }
    );
  }
}

export default new PushService();
