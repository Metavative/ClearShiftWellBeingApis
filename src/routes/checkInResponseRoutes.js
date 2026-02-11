import { Router } from "express";
import {
  submitCheckIn,
  listResponses,
  updateAckStatus,
} from "../controllers/checkInResponseController.js";
const router = Router();

router.get("/", listResponses);
router.post("/", submitCheckIn);
router.patch("/:id/ack", updateAckStatus);

export default router;
