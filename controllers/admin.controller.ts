import type { Request, Response, NextFunction } from "express";
import type { AccountStatus, ActivityStatus, ActivityType, UserRole } from "../generated/prisma/client";
import APIResponse from "../lib/APIResponse";
import AppError from "../lib/AppError";
import adminService from "../services/admin.service";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  adminCreatePromoterSchema,
  changeRoleSchema,
} from "../schemas/admin.schema";

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

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = adminCreateUserSchema.validate(req.body, {
        abortEarly: false,
      });
      if (error) {
        throw new AppError(
          400,
          error.details.map((d) => d.message).join(", ")
        );
      }

      const user = await adminService.createUser(value);
      res
        .status(201)
        .json(new APIResponse(true, "User created successfully", user));
    } catch (error) {
      next(error);
    }
  }

  async createPromoter(req: Request, res: Response, next: NextFunction) {
    try {
      const { error, value } = adminCreatePromoterSchema.validate(req.body, {
        abortEarly: false,
      });
      if (error) {
        throw new AppError(
          400,
          error.details.map((d) => d.message).join(", ")
        );
      }

      const user = await adminService.createPromoter(value);
      res
        .status(201)
        .json(new APIResponse(true, "Promoter created successfully", user));
    } catch (error) {
      next(error);
    }
  }

  async previewReferCode(req: Request, res: Response, next: NextFunction) {
    try {
      const firstName = req.query.firstName as string;
      const lastName = req.query.lastName as string;

      if (!firstName || !lastName) {
        throw new AppError(400, "firstName and lastName are required");
      }

      const result = await adminService.previewReferCode(firstName, lastName);
      res
        .status(200)
        .json(new APIResponse(true, "Refer code preview generated", result));
    } catch (error) {
      next(error);
    }
  }

  async getPromoters(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const role = req.query.role as "INFLUENCER" | "PROMOTER" | undefined;

      const result = await adminService.getPromoters(page, limit, search, role);
      res
        .status(200)
        .json(new APIResponse(true, "Promoters retrieved successfully", result));
    } catch (error) {
      next(error);
    }
  }

  async getMarketingStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminService.getMarketingStats();
      res
        .status(200)
        .json(new APIResponse(true, "Marketing stats retrieved successfully", data));
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { error, value } = adminUpdateUserSchema.validate(req.body, {
        abortEarly: false,
      });
      if (error) {
        throw new AppError(
          400,
          error.details.map((d) => d.message).join(", ")
        );
      }

      const user = await adminService.updateUser(id, value);
      res
        .status(200)
        .json(new APIResponse(true, "User updated successfully", user));
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await adminService.deleteUser(id);
      res
        .status(200)
        .json(new APIResponse(true, "User deleted successfully"));
    } catch (error) {
      next(error);
    }
  }

  async changeUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { error, value } = changeRoleSchema.validate(req.body, {
        abortEarly: false,
      });
      if (error) {
        throw new AppError(
          400,
          error.details.map((d) => d.message).join(", ")
        );
      }

      const user = await adminService.changeUserRole(id, value.role as UserRole);
      res
        .status(200)
        .json(new APIResponse(true, "User role updated successfully", user));
    } catch (error) {
      next(error);
    }
  }

  async toggleAchPush(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { enabled } = req.body;

      if (typeof enabled !== "boolean") {
        throw new AppError(400, "enabled must be a boolean");
      }

      const user = await adminService.toggleAchPush(id, enabled);
      res
        .status(200)
        .json(new APIResponse(true, "ACH push setting updated successfully", user));
    } catch (error) {
      next(error);
    }
  }

  async getReferralStats(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;

      const data = await adminService.getReferralStats(page, limit, search);
      res
        .status(200)
        .json(new APIResponse(true, "Referral stats retrieved successfully", data));
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
