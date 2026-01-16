import express from "express";
import {
  getPrivacyPolicy,
  getAllPrivacyPolicies,
  createPrivacyPolicy,
  updatePrivacyPolicy,
  deletePrivacyPolicy,
  getSupportToolContent,
  getAllSupportToolContents,
  createSupportToolContent,
  updateSupportToolContent,
  deleteSupportToolContent,
} from "../controllers/contentController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Public route - get active privacy policy for app
router.get("/privacy-policy", getPrivacyPolicy);
router.get("/support-tools", getSupportToolContent);

// Superadmin routes - require superadmin authentication
router.get("/privacy-policies", getAllPrivacyPolicies);
router.post("/privacy-policy", createPrivacyPolicy);
router.put("/privacy-policy/:id", updatePrivacyPolicy);
router.delete("/privacy-policy/:id", deletePrivacyPolicy);

router.get("/support-tools/all", getAllSupportToolContents);
router.post("/support-tools", createSupportToolContent);
router.put("/support-tools/:id", updateSupportToolContent);
router.delete("/support-tools/:id", deleteSupportToolContent);

export default router;
