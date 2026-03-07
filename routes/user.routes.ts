import type { RequestHandler } from "express";
import express from "express";
import userController from "../controllers/user.controller";
import dbUser from "../middlewares/db-user";
import { sensitiveRateLimit } from "../middlewares/strict-rate-limit";

const router = express.Router();

router.post("/", sensitiveRateLimit as RequestHandler, userController.create as RequestHandler);
router.put("/update-user", dbUser, userController.update as RequestHandler);
router.put("/me", dbUser, userController.update as RequestHandler);

export default router;
