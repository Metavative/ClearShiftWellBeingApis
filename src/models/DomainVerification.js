import mongoose from "mongoose";

const DomainVerificationSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, unique: true, index: true },
    host: { type: String, required: true, default: "_gp-verify" },
    ttl: { type: Number, default: 3600 },
    token: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
    verifiedAt: { type: Date },
    expiresAt: { type: Date },
    lastCheckedAt: { type: Date },
    attempts: { type: Number, default: 0 },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReferralCompanies",
      required: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdminLogin",
      required: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("DomainVerification", DomainVerificationSchema);
