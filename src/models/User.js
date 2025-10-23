// models/User.js
import mongoose from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    // tenant scoping
    domain: { type: String, index: true },

    name: { type: String, trim: true, default: "" },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Invalid email"],
    },

    password: { type: String, minlength: 8, select: false },

    role: {
      type: String,
      enum: ["employee", "admin"],
      default: "employee",
      index: true,
    },

    emailVerified: { type: Boolean, default: false },

    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

// hash password on change
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  const rounds = Number(process.env.PASSWORD_SALT_ROUNDS || 12);
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model("User", userSchema);
