import { Router } from "express";
import {
  submitCheckIn,
  listResponses,
} from "../controllers/checkInResponseController.js";
const router = Router();

router.get("/", listResponses);
router.post("/", submitCheckIn);

export default router;
