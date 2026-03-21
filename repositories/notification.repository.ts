import prismaClient from "../lib/prisma-client";
import PrismaRepository from "./base.repository";
import type { NotificationFilters } from "../schemas/notification.schema";
import { Prisma } from "../generated/prisma/client";

const baseRepository = new PrismaRepository(prismaClient.notification);

class NotificationRepository {
  async findByUserId(userId: string, filters: NotificationFilters) {
    const where: Record<string, unknown> = { userId };
    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    const [items, total] = await prismaClient.$transaction([
      prismaClient.notification.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: filters.limit,
        skip: filters.offset,
      }),
      prismaClient.notification.count({ where }),
    ]);

    return { items, total };
  }

  async getUnreadCount(userId: string) {
    return prismaClient.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string) {
    return prismaClient.notification.update({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return prismaClient.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    return prismaClient.notification.delete({
      where: { id, userId },
    });
  }

  async create(data: {
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown> | null;
  }) {
    const metadata =
      data.metadata === null
        ? Prisma.JsonNull
        : (data.metadata as Prisma.InputJsonValue | undefined);

    return prismaClient.notification.create({
      data: { ...data, metadata },
    });
  }
}

export default new NotificationRepository();
