import { Router } from "express";
import {
  getCheckInQuestions,
  createCheckInQuestion,
  updateCheckInQuestion,
  deleteCheckInQuestion,
  getCheckInQuestionById,
  getCheckInQuestionByQuestion,
} from "../controllers/checkInQuestionController.js";

const router = Router();

router.get("/", getCheckInQuestions);
router.post("/", createCheckInQuestion);
router.put("/:id", updateCheckInQuestion);
router.delete("/:id", deleteCheckInQuestion);
router.get("/:id", getCheckInQuestionById);
router.get("/question/:question", getCheckInQuestionByQuestion);

export default router;
