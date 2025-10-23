import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CheckInQuestions",
      required: true,
    },
    question: { type: String, required: true },
    option: { type: String, required: true },
    description: { type: String },
  },
  { _id: false }
);

const checkInResponseSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    submittedAt: { type: Date, default: Date.now, index: true },
    answers: { type: [answerSchema], default: [] },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

const CheckInResponse = mongoose.model(
  "CheckInResponse",
  checkInResponseSchema
);
export default CheckInResponse;
