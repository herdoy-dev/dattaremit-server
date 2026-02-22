import express from "express";
import account from "./account.route";
import activities from "./activity.routes";
import addresses from "./address.routes";
import onboarding from "./onboarding.routes";
import users from "./user.routes";
import zynk from "./zynk.routes";
import dbUser from "../middlewares/db-user";

const router = express.Router();

router.use("/", account);
router.use("/users", users);
router.use("/addresses", addresses);
router.use("/onboarding", onboarding);
router.use("/zynk", dbUser, zynk);
router.use("/activity", activities);

export default router;
