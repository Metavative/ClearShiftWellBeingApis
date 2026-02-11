import { Router } from "express";
import {
  submitSupportRequest,
  listSupportRequests,
  updateSupportRequestStatus,
} from "../controllers/supportRequestController.js";

const router = Router();

router.get("/", listSupportRequests);
router.post("/", submitSupportRequest);
router.patch("/:id/status", updateSupportRequestStatus);

export default router;
