import mongoose from "mongoose";

const referralCompaniesSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phoneNumber: { type: Number, required: true },
  },
  { timestamps: true }
);

export const ReferralCompanies = mongoose.model(
  "ReferralCompanies",
  referralCompaniesSchema
);
