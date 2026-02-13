import prismaClient from "../lib/prisma-client";
import PrismaRepository from "./base.repository";
import type {
  CreateActivityInput,
  UpdateActivityInput,
  GetActivitiesQuery,
} from "../schemas/activity.schema";
import type { ActivityStatus, ActivityType } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";

function normalizeActivityData<
  T extends { metadata?: Record<string, unknown> | null }
>(
  data: T
): Omit<T, "metadata"> & {
  metadata?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
} {
  const { metadata, ...rest } = data as Record<string, unknown>;
  if (metadata === null) {
    return {
      ...rest,
      metadata: Prisma.JsonNull,
    } as unknown as ReturnType<typeof normalizeActivityData<T>>;
  }
  if (metadata !== undefined) {
    return {
      ...rest,
      metadata: metadata as Prisma.InputJsonValue,
    } as unknown as ReturnType<typeof normalizeActivityData<T>>;
  }
  return rest as unknown as ReturnType<typeof normalizeActivityData<T>>;
}

const baseRepository = new PrismaRepository(
  prismaClient.activity,
  { user: true }
);

class ActivityRepository {
  async findWithFilters(userId: string, filters: GetActivitiesQuery) {
    const where = {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.referenceId ? { referenceId: filters.referenceId } : {}),
      ...(filters.from && filters.to
        ? {
            created_at: {
              gte: new Date(filters.from),
              lte: new Date(filters.to),
            },
          }
        : {}),
    };

    const [items, total] = await prismaClient.$transaction([
      prismaClient.activity.findMany({
        where,
        include: { user: true },
        orderBy: { created_at: "desc" },
        take: filters.limit,
        skip: filters.offset,
      }),
      prismaClient.activity.count({ where }),
    ]);

    return { items, total };
  }

  async findAll() {
    return baseRepository.findMany({ orderBy: { created_at: "desc" } });
  }

  async findById(id: string) {
    return baseRepository.findUnique({ id });
  }

  async findByUserId(userId: string) {
    return baseRepository.findMany({
      where: { userId },
      orderBy: { created_at: "desc" },
    });
  }

  async findByStatus(status: ActivityStatus) {
    return baseRepository.findMany({
      where: { status },
      orderBy: { created_at: "desc" },
    });
  }

  async findByType(type: ActivityType) {
    return baseRepository.findMany({
      where: { type },
      orderBy: { created_at: "desc" },
    });
  }

  async findByUserIdAndStatus(userId: string, status: ActivityStatus) {
    return baseRepository.findMany({
      where: { userId, status },
      orderBy: { created_at: "desc" },
    });
  }

  async create(data: CreateActivityInput) {
    return baseRepository.create(normalizeActivityData(data));
  }

  async update(id: string, data: UpdateActivityInput) {
    return baseRepository.update({ id }, normalizeActivityData(data));
  }

  async updateStatus(id: string, status: ActivityStatus) {
    return baseRepository.update({ id }, { status });
  }

  async delete(id: string) {
    return baseRepository.delete({ id });
  }

  async deleteByUserId(userId: string) {
    return baseRepository.deleteMany({ userId });
  }
}

export default new ActivityRepository();
