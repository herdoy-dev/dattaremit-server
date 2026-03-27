import express from "express";
import account from "./account.route";
import activities from "./activity.routes";
import addresses from "./address.routes";
import contacts from "./contact.routes";
import devices from "./device.routes";
import googleMaps from "./google-maps.routes";
import notifications from "./notification.routes";
import onboarding from "./onboarding.routes";
import referral from "./referral.routes";
import transfers from "./transfer.routes";
import users from "./user.routes";
import zynk from "./zynk.routes";
import dbUser from "../middlewares/db-user";

const router = express.Router();

router.use("/", account);
router.use("/users", users);
router.use("/addresses", addresses);
router.use("/contacts", dbUser, contacts);
router.use("/onboarding", onboarding);
router.use("/referral", referral);
router.use("/transfers", dbUser, transfers);
router.use("/zynk", dbUser, zynk);
router.use("/activity", activities);
router.use("/notifications", notifications);
router.use("/devices", devices);
router.use("/google-maps", googleMaps);

export default router;
