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
    isPositive: { type: Boolean, default: true },
    isSupport: { type: Boolean, default: false },
  },
  { _id: false }
);

const checkInResponseSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    submittedAt: { type: Date, default: Date.now, index: true },
    answers: { type: [answerSchema], default: [] },
    supportRequested: { type: Boolean, default: false, index: true },
    acked: { type: Boolean, default: false },
    ackedAt: { type: Date, default: null },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

const CheckInResponse = mongoose.model(
  "CheckInResponse",
  checkInResponseSchema
);
export default CheckInResponse;
