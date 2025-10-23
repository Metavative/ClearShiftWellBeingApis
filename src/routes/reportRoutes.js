import { Router } from "express";
import {
  weeklyReport,
  weeklyReportPdf,
} from "../controllers/reportController.js";
const router = Router();

router.get("/weekly", weeklyReport); // JSON summary
router.get("/weekly/pdf", weeklyReportPdf); // PDF file

export default router;
