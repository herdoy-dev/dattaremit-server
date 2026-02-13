import express from "express";
import account from "./account.route";
import activities from "./activity.routes";
import addresses from "./address.routes";
import externalAccounts from "./external-accounts.routes";
import transfer from "./transfer.routes";
import users from "./user.routes";
import zynk from "./zynk.routes";
import dbUser from "../middlewares/db-user";
import isApproved from "../middlewares/is-approved";

const router = express.Router();

router.use("/", account);
router.use("/users", users);
router.use("/addresses", addresses);
router.use("/zynk", dbUser, zynk);
router.use("/external-accounts", [dbUser, isApproved], externalAccounts);
router.use("/transfer", [dbUser, isApproved], transfer);
router.use("/activity", activities);

export default router;
