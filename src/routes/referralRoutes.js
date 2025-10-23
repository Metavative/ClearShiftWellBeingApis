import { Router } from "express";
import {
  getReferralCompanies,
  createReferralCompany,
  updateReferralCompany,
  deleteReferralCompany,
  getReferralCompanyById,
  getReferralCompanyByPhoneNumber,
} from "../controllers/referralCompaniesController.js";

const router = Router();

router.get("/", getReferralCompanies);
router.post("/", createReferralCompany);
router.put("/:id", updateReferralCompany);
router.delete("/:id", deleteReferralCompany);
router.get("/:id", getReferralCompanyById);
router.get("/phone-number/:phoneNumber", getReferralCompanyByPhoneNumber);

export default router;
