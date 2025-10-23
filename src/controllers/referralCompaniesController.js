import { ReferralCompanies } from "../models/ReferralCompanies.js";

export const getReferralCompanies = async (req, res) => {
  const referralCompanies = await ReferralCompanies.find();
  res.json(referralCompanies);
};

export const createReferralCompany = async (req, res) => {
  const { name, phoneNumber } = req.body;
  const referralCompany = await ReferralCompanies.create({ name, phoneNumber });
  res.json(referralCompany);
};

export const updateReferralCompany = async (req, res) => {
  const { id } = req.params;
  const { name, phoneNumber } = req.body;
  const referralCompany = await ReferralCompanies.findByIdAndUpdate(
    id,
    { name, phoneNumber },
    { new: true }
  );
  res.json(referralCompany);
};

export const deleteReferralCompany = async (req, res) => {
  const { id } = req.params;
  await ReferralCompanies.findByIdAndDelete(id);
  res.json({ message: "Referral company deleted successfully" });
};

export const getReferralCompanyById = async (req, res) => {
  const { id } = req.params;
  const referralCompany = await ReferralCompanies.findById(id);
  res.json(referralCompany);
};

export const getReferralCompanyByPhoneNumber = async (req, res) => {
  const { phoneNumber } = req.params;
  const referralCompany = await ReferralCompanies.findOne({ phoneNumber });
  res.json(referralCompany);
};
