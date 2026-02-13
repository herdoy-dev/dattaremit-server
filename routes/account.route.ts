import type { RequestHandler } from "express";
import express from "express";
import accountController from "../controllers/account.controller";

const router = express.Router();

router.get("/account", accountController.getAccount as RequestHandler);

export default router;
