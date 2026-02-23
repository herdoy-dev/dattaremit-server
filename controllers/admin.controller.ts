import type { Request, Response, NextFunction } from "express";
import type { AccountStatus, ActivityStatus, ActivityType } from "../generated/prisma/client";
import APIResponse from "../lib/APIResponse";
import adminService from "../services/admin.service";

class AdminController {
  async getDashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardStats();
      res
        .status(200)
        .json(new APIResponse(true, "Dashboard stats retrieved successfully", stats));
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const status = req.query.status as AccountStatus | undefined;

      const result = await adminService.getUsers(page, limit, search, status);
      res
        .status(200)
        .json(new APIResponse(true, "Users retrieved successfully", result));
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const user = await adminService.getUserById(id);
      res
        .status(200)
        .json(new APIResponse(true, "User retrieved successfully", user));
    } catch (error) {
      next(error);
    }
  }

  async getActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as ActivityType | undefined;
      const status = req.query.status as ActivityStatus | undefined;

      const result = await adminService.getActivities(page, limit, type, status);
      res
        .status(200)
        .json(new APIResponse(true, "Activities retrieved successfully", result));
    } catch (error) {
      next(error);
    }
  }

  async getRegistrationChart(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getRegistrationChart();
      res
        .status(200)
        .json(new APIResponse(true, "Registration chart data retrieved successfully", data));
    } catch (error) {
      next(error);
    }
  }

  async getActivityTypeChart(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getActivityTypeChart();
      res
        .status(200)
        .json(new APIResponse(true, "Activity type chart data retrieved successfully", data));
    } catch (error) {
      next(error);
    }
  }

  async getAccountStatusChart(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getAccountStatusChart();
      res
        .status(200)
        .json(new APIResponse(true, "Account status chart data retrieved successfully", data));
    } catch (error) {
      next(error);
    }
  }

  async getKycActivityChart(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getKycActivityChart();
      res
        .status(200)
        .json(new APIResponse(true, "KYC activity chart data retrieved successfully", data));
    } catch (error) {
      next(error);
    }
  }

  async getReferralStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getReferralStats();
      res
        .status(200)
        .json(new APIResponse(true, "Referral stats retrieved successfully", data));
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
