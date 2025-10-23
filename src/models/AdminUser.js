import mongoose from "mongoose";

const AdminUserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },

    // link to verified domain
    domain: { type: String, required: true, index: true },
    domainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DomainVerification",
      required: true,
    },

    // license info
    licenseKey: { type: String, required: true, unique: true, index: true },
    licenseStatus: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
    },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },

    // audit
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
export default mongoose.model("AdminUser", AdminUserSchema);
