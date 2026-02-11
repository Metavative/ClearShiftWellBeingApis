import { Router } from "express";
import {
  weeklyReport,
  weeklyReportPdf,
  weeklyReportEmail,
} from "../controllers/reportController.js";
const router = Router();

router.get("/weekly", weeklyReport); // JSON summary
router.get("/weekly/pdf", weeklyReportPdf); // PDF file
router.post("/weekly/email", weeklyReportEmail); // trigger weekly summary email

export default router;
