import type { RequestHandler } from "express";
import express from "express";
import adminAuth from "../middlewares/admin-auth";
import adminController from "../controllers/admin.controller";

const router = express.Router();

router.use(adminAuth);

router.get("/stats", adminController.getDashboardStats as RequestHandler);
router.get("/users", adminController.getUsers as RequestHandler);
router.post("/users", adminController.createUser as RequestHandler);
router.get("/users/:id", adminController.getUserById as RequestHandler);
router.put("/users/:id", adminController.updateUser as RequestHandler);
router.delete("/users/:id", adminController.deleteUser as RequestHandler);
router.patch("/users/:id/role", adminController.changeUserRole as RequestHandler);
router.patch("/users/:id/ach-push", adminController.toggleAchPush as RequestHandler);
router.get("/activities", adminController.getActivities as RequestHandler);
router.get("/charts/registrations", adminController.getRegistrationChart as RequestHandler);
router.get("/charts/activity-types", adminController.getActivityTypeChart as RequestHandler);
router.get("/charts/account-status", adminController.getAccountStatusChart as RequestHandler);
router.get("/charts/kyc", adminController.getKycActivityChart as RequestHandler);
router.get("/referral-stats", adminController.getReferralStats as RequestHandler);

// Settings routes
router.get("/settings", adminController.getSettings as RequestHandler);
router.put("/settings", adminController.updateSetting as RequestHandler);

// Marketing routes
router.get("/marketing/promoters/preview-refer-code", adminController.previewReferCode as RequestHandler);
router.post("/marketing/promoters", adminController.createPromoter as RequestHandler);
router.get("/marketing/promoters", adminController.getPromoters as RequestHandler);
router.get("/marketing/stats", adminController.getMarketingStats as RequestHandler);

export default router;
