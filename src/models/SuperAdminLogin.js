import mongoose from "mongoose";
import validator from "validator";

const superAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Invalid email"],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ["super_admin", "admin"],
      default: "admin",
    },
    profile_picture: {
      key: String,
      url: String,
    },
    emailVerified: { type: Boolean, default: false },
    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

export const SuperAdmin = mongoose.model("superAdminSchema", superAdminSchema);
