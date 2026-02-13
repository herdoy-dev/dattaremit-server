import type { RequestHandler } from "express";
import express from "express";
import activityController from "../controllers/activity.controller";
import dbUser from "../middlewares/db-user";

const router = express.Router();

router.get("/", dbUser, activityController.list as RequestHandler);
router.get("/:id", dbUser, activityController.getById as RequestHandler);

export default router;
