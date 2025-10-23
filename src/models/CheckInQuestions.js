import mongoose from "mongoose";

const checkInQuestionsSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, index: true },
    question: { type: String, required: true },
    options: { type: [String], default: [] },
    description: String,
    isPositive: { type: Boolean, default: true },
    isSupport: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CheckInQuestions = mongoose.model(
  "CheckInQuestions",
  checkInQuestionsSchema
);

export default CheckInQuestions;
