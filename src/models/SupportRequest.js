import mongoose from "mongoose";

const supportRequestSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, index: true },
    employeeId: { type: String, default: "", index: true },
    supportType: {
      type: String,
      enum: ["hr", "eap", "crisis", "other"],
      default: "hr",
      index: true,
    },
    message: { type: String, default: "" },
    contact: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    checkinId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["new", "in_progress", "resolved"],
      default: "new",
      index: true,
    },
    statusUpdatedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    routedTo: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

supportRequestSchema.index({ domain: 1, submittedAt: -1 });

const SupportRequest = mongoose.model("SupportRequest", supportRequestSchema);
export default SupportRequest;
