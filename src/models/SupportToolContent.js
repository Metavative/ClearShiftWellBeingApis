import mongoose from "mongoose";

const supportToolContentSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, index: true },
    tips: [{ type: String }],
    eap: [{ type: String }],
    hr: [{ type: String }],
    crisis: [{ type: String }],
    
    version: { type: Number, default: 1 },

    isActive: { type: Boolean, default: true, index: true },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdminLogin" },
  },
  { timestamps: true }
);

export const SupportToolContent = mongoose.model(
  "SupportToolContent",
  supportToolContentSchema
);
