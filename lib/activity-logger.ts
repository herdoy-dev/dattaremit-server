import activityService from "../services/activity.service";
import type {
  CreateActivityInput,
  UpdateActivityInput,
} from "../schemas/activity.schema";
import { ActivityStatus } from "../generated/prisma/client";
import logger from "./logger";

type LogResult = { id?: string };

async function logActivity(data: CreateActivityInput): Promise<LogResult> {
  try {
    const activity = await activityService.create(data);
    return { id: activity.id };
  } catch (error) {
    logger.warn("Failed to create activity", {
      error: error instanceof Error ? error.message : String(error),
      activityType: data.type,
      userId: data.userId,
    });
    return {};
  }
}

async function updateActivity(
  id: string,
  data: UpdateActivityInput
): Promise<void> {
  try {
    await activityService.update(id, data);
  } catch (error) {
    logger.warn("Failed to update activity", {
      error: error instanceof Error ? error.message : String(error),
      activityId: id,
    });
  }
}

async function markComplete(
  id: string,
  data?: Omit<UpdateActivityInput, "status">
) {
  return updateActivity(id, { status: ActivityStatus.COMPLETE, ...data });
}

async function markFailed(
  id: string,
  data?: Omit<UpdateActivityInput, "status">
) {
  return updateActivity(id, { status: ActivityStatus.FAILED, ...data });
}

export default {
  logActivity,
  updateActivity,
  markComplete,
  markFailed,
};
