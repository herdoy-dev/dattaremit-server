import type { RequestHandler } from "express";
import express from "express";
import userController from "../controllers/user.controller";
import dbUser from "../middlewares/db-user";

const router = express.Router();

router.post("/", userController.create as RequestHandler);
router.put("/update-user", dbUser, userController.update as RequestHandler);
router.put("/me", dbUser, userController.update as RequestHandler);

export default router;
