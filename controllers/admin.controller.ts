import type { Request, Response } from "express";
import type { AuthRequest } from "../middlewares/auth";
import type { AccountStatus, ActivityStatus, ActivityType, UserRole } from "../generated/prisma/client";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import asyncHandler from "../lib/async-handler";
import validate from "../lib/validate";
import adminService from "../services/admin.service";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminCreatePromoterSchema,
  changeRoleSchema,
} from "../schemas/admin.schema";

const MAX_PAGE_LIMIT = 100;
const MAX_SEARCH_LENGTH = 200;

function parsePagination(query: Request["query"]) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(query.limit as string) || 20));
  const search = query.search ? String(query.search).slice(0, MAX_SEARCH_LENGTH) : undefined;
  return { page, limit, search };
}

class AdminController {
  getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await adminService.getDashboardStats();
    res
      .status(200)
      .json(new APIResponse(true, "Dashboard stats retrieved successfully", stats));
  });

  getUsers = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search } = parsePagination(req.query);
    const status = req.query.status as AccountStatus | undefined;

    const result = await adminService.getUsers(page, limit, search, status);
    res
      .status(200)
      .json(new APIResponse(true, "Users retrieved successfully", result));
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const user = await adminService.getUserById(id);
    res
      .status(200)
      .json(new APIResponse(true, "User retrieved successfully", user));
  });

  getActivities = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = parsePagination(req.query);
    const type = req.query.type as ActivityType | undefined;
    const status = req.query.status as ActivityStatus | undefined;

    const result = await adminService.getActivities(page, limit, type, status);
    res
      .status(200)
      .json(new APIResponse(true, "Activities retrieved successfully", result));
  });

  getRegistrationChart = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.getRegistrationChart();
    res
      .status(200)
      .json(new APIResponse(true, "Registration chart data retrieved successfully", data));
  });

  getActivityTypeChart = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.getActivityTypeChart();
    res
      .status(200)
      .json(new APIResponse(true, "Activity type chart data retrieved successfully", data));
  });

  getAccountStatusChart = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.getAccountStatusChart();
    res
      .status(200)
      .json(new APIResponse(true, "Account status chart data retrieved successfully", data));
  });

  getKycActivityChart = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.getKycActivityChart();
    res
      .status(200)
      .json(new APIResponse(true, "KYC activity chart data retrieved successfully", data));
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const value = validate(adminCreateUserSchema, req.body);

    const actingAdminId = (req as AuthRequest).user.id;
    const user = await adminService.createUser(value, actingAdminId);
    res
      .status(201)
      .json(new APIResponse(true, "User created successfully", user));
  });

  createPromoter = asyncHandler(async (req: Request, res: Response) => {
    const value = validate(adminCreatePromoterSchema, req.body);

    const actingAdminId = (req as AuthRequest).user.id;
    const user = await adminService.createPromoter(value, actingAdminId);
    res
      .status(201)
      .json(new APIResponse(true, "Promoter created successfully", user));
  });

  previewReferCode = asyncHandler(async (req: Request, res: Response) => {
    const firstName = req.query.firstName as string;
    const lastName = req.query.lastName as string;

    if (!firstName || !lastName) {
      throw new AppError(400, "firstName and lastName are required");
    }

    const result = await adminService.previewReferCode(firstName, lastName);
    res
      .status(200)
      .json(new APIResponse(true, "Refer code preview generated", result));
  });

  getPromoters = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search } = parsePagination(req.query);
    const role = req.query.role as "INFLUENCER" | "PROMOTER" | undefined;

    const result = await adminService.getPromoters(page, limit, search, role);
    res
      .status(200)
      .json(new APIResponse(true, "Promoters retrieved successfully", result));
  });

  getMarketingStats = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.getMarketingStats();
    res
      .status(200)
      .json(new APIResponse(true, "Marketing stats retrieved successfully", data));
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const value = validate(adminUpdateUserSchema, req.body);

    const actingAdminId = (req as AuthRequest).user.id;
    const user = await adminService.updateUser(id, value, actingAdminId);
    res
      .status(200)
      .json(new APIResponse(true, "User updated successfully", user));
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const actingAdminId = (req as AuthRequest).user.id;
    await adminService.deleteUser(id, actingAdminId);
    res
      .status(200)
      .json(new APIResponse(true, "User deleted successfully"));
  });

  changeUserRole = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const value = validate(changeRoleSchema, req.body, { stripUnknown: false });

    const actingAdminId = (req as AuthRequest).user.id;
    const user = await adminService.changeUserRole(id, value.role as UserRole, actingAdminId);
    res
      .status(200)
      .json(new APIResponse(true, "User role updated successfully", user));
  });

  toggleAchPush = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      throw new AppError(400, "enabled must be a boolean");
    }

    const actingAdminId = (req as AuthRequest).user.id;
    const user = await adminService.toggleAchPush(id, enabled, actingAdminId);
    res
      .status(200)
      .json(new APIResponse(true, "ACH push setting updated successfully", user));
  });

  getReferralStats = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, search } = parsePagination(req.query);

    const data = await adminService.getReferralStats(page, limit, search);
    res
      .status(200)
      .json(new APIResponse(true, "Referral stats retrieved successfully", data));
  });
}

export default new AdminController();
