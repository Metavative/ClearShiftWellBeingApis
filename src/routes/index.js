import { Router } from "express";
import authRoutes from "./authRoutes.js";
import checkInRoutes from "./checkInRoutes.js";
import referralRoutes from "./referralRoutes.js";
import domainRoutes from "./domainRoutes.js";
import adminRoutes from "./adminRoutes.js";
import checkInResponseRoutes from "./checkInResponseRoutes.js";
import companyUserRoutes from "./companyUserRoutes.js";
import reportRoutes from "./reportRoutes.js";
import contentRoutes from "./contentRoutes.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.use("/auth", authRoutes);
router.use("/referral", referralRoutes);
router.use("/content", contentRoutes);
router.use("/domains", domainRoutes);
router.use("/admins", adminRoutes);
router.use("/checkin-responses", checkInResponseRoutes);
router.use("/checkin", checkInRoutes);
router.use("/company/users", companyUserRoutes);
router.use("/reports", reportRoutes);

export default router;
