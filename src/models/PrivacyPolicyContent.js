import mongoose from "mongoose";

const privacyPolicyContentSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "Privacy Policy" },

    domain: { type: String, required: true, index: true },

    content: { type: String, required: true },

    version: { type: Number, default: 1 },

    isActive: { type: Boolean, default: true, index: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdminLogin" },
  },
  { timestamps: true }
);

export const PrivacyPolicyContent = mongoose.model(
  "PrivacyPolicyContent",
  privacyPolicyContentSchema
);
