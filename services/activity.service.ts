import AppError from "../lib/AppError";
import prismaClient, { decryptNestedUser } from "../lib/prisma-client";
import activityRepository from "../repositories/activity.repository";
import type {
  CreateActivityInput,
  GetActivitiesQuery,
  UpdateActivityInput,
} from "../schemas/activity.schema";
import type { ActivityStatus, ActivityType } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";

class ActivityService {
  async getActivities(userId: string, query: GetActivitiesQuery) {
    return activityRepository.findWithFilters(userId, query);
  }

  async getAll() {
    return activityRepository.findAll();
  }

  async getById(id: string) {
    const activity = await activityRepository.findById(id);
    if (!activity) {
      throw new AppError(404, "Activity not found");
    }
    return activity;
  }

  async getByUserId(userId: string) {
    return activityRepository.findByUserId(userId);
  }

  async getByStatus(status: ActivityStatus) {
    return activityRepository.findByStatus(status);
  }

  async getByType(type: ActivityType) {
    return activityRepository.findByType(type);
  }

  async getByUserIdAndStatus(userId: string, status: ActivityStatus) {
    return activityRepository.findByUserIdAndStatus(userId, status);
  }

  async create(data: CreateActivityInput) {
    return prismaClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: data.userId },
      });

      if (!user) {
        throw new AppError(404, "User not found");
      }

      const metadata =
        data.metadata === null
          ? Prisma.JsonNull
          : (data.metadata as Prisma.InputJsonValue | undefined);

      const activity = await tx.activity.create({
        data: {
          ...data,
          metadata,
        },
        include: { user: true },
      });

      return decryptNestedUser(activity);
    });
  }

  async update(id: string, data: UpdateActivityInput) {
    const activity = await activityRepository.findById(id);
    if (!activity) {
      throw new AppError(404, "Activity not found");
    }
    return activityRepository.update(id, data);
  }

  async updateStatus(id: string, status: ActivityStatus) {
    const activity = await activityRepository.findById(id);
    if (!activity) {
      throw new AppError(404, "Activity not found");
    }
    return activityRepository.updateStatus(id, status);
  }

  async delete(id: string) {
    const activity = await activityRepository.findById(id);
    if (!activity) {
      throw new AppError(404, "Activity not found");
    }
    return activityRepository.delete(id);
  }

  async deleteByUserId(userId: string) {
    return activityRepository.deleteByUserId(userId);
  }
}

export default new ActivityService();
