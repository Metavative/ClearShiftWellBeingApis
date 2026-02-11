import mongoose from "mongoose";

const weeklyReportDispatchSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, index: true },
    weekEnding: { type: String, required: true, index: true }, // YYYY-MM-DD
    recipients: [{ type: String }],
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

weeklyReportDispatchSchema.index({ domain: 1, weekEnding: 1 }, { unique: true });

export const WeeklyReportDispatch = mongoose.model(
  "WeeklyReportDispatch",
  weeklyReportDispatchSchema
);

export default WeeklyReportDispatch;
