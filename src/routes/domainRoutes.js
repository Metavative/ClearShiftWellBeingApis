import { Router } from "express";
import {
  previewVerification,
  initiateVerification,
  checkVerification,
  listDomains,
  getDomain,
  updateDomain,
  deleteDomain,
  rotateToken,
} from "../controllers/domainVerificationController.js";
// import { requireAuth } from "../middleware/auth.js";

const router = Router();

// CRUD
router.get("/", listDomains);
router.get("/:id", getDomain);
router.patch("/:id", updateDomain);
router.delete("/:id", deleteDomain);

// protect if needed:
router.post("/verify/preview", previewVerification);
router.post("/verify/initiate", initiateVerification);
router.get("/verify/check", checkVerification);

// optional admin list
router.get("/", listDomains);

export default router;
