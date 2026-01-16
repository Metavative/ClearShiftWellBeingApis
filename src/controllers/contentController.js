import { PrivacyPolicyContent } from "../models/PrivacyPolicyContent.js";
import { SupportToolContent } from "../models/SupportToolContent.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get active privacy policy content for app
export const getPrivacyPolicy = asyncHandler(async (req, res) => {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ message: "Domain is required" });
  }

  const policy = await PrivacyPolicyContent.findOne({
    isActive: true,
    domain,
  });

  if (!policy) {
    return res.status(404).json({ message: "Privacy policy not found" });
  }

  res.status(200).json({
    success: true,
    data: policy,
  });
});

// Get all privacy policies (for superadmin)
export const getAllPrivacyPolicies = asyncHandler(async (req, res) => {
  const policies = await PrivacyPolicyContent.find({}).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: policies.length,
    data: policies,
  });
});

// Create privacy policy content
export const createPrivacyPolicy = asyncHandler(async (req, res) => {
  const { title, content, domain } = req.body;
  const superAdminId = req.user?.id;

  if (!content) {
    return res.status(400).json({
      message: "Content is required",
    });
  }

  if (!domain) {
    return res.status(400).json({
      message: "Domain is required",
    });
  }

  // Deactivate any existing active policy for this domain and create new one
  await PrivacyPolicyContent.updateMany(
    { isActive: true, domain },
    { isActive: false }
  );

  const policy = new PrivacyPolicyContent({
    title: title || "Privacy Policy",
    content,
    domain,
    isActive: true,
    updatedBy: superAdminId,
    version: 1,
  });

  await policy.save();

  res.status(201).json({
    success: true,
    message: "Privacy policy created successfully",
    data: policy,
  });
});

// Update privacy policy content
export const updatePrivacyPolicy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const superAdminId = req.user?.id;

  if (!content) {
    return res.status(400).json({
      message: "Content is required",
    });
  }

  const policy = await PrivacyPolicyContent.findById(id);

  if (!policy) {
    return res.status(404).json({ message: "Privacy policy not found" });
  }

  // Update the policy
  policy.title = title || policy.title;
  policy.content = content;
  policy.version = (policy.version || 1) + 1;
  policy.updatedBy = superAdminId;

  await policy.save();

  res.status(200).json({
    success: true,
    message: "Privacy policy updated successfully",
    data: policy,
  });
});

// Delete privacy policy
export const deletePrivacyPolicy = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const policy = await PrivacyPolicyContent.findByIdAndDelete(id);

  if (!policy) {
    return res.status(404).json({ message: "Privacy policy not found" });
  }

  res.status(200).json({
    success: true,
    message: "Privacy policy deleted successfully",
  });
});

// Get active support tool content for app
export const getSupportToolContent = asyncHandler(async (req, res) => {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ message: "Domain is required" });
  }

  const content = await SupportToolContent.findOne({
    isActive: true,
    domain,
  });

  if (!content) {
    return res.status(404).json({ message: "Support tool content not found" });
  }

  res.status(200).json({
    success: true,
    data: content,
  });
});

// Get all support tool contents (for superadmin)
export const getAllSupportToolContents = asyncHandler(async (req, res) => {
  const contents = await SupportToolContent.find({}).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: contents.length,
    data: contents,
  });
});

// Create support tool content
export const createSupportToolContent = asyncHandler(async (req, res) => {
  const { tips, eap, hr, crisis, domain } = req.body;
  const superAdminId = req.user?.sub || req.user?.id;

  if (!domain) {
    return res.status(400).json({
      message: "Domain is required",
    });
  }

  // Deactivate any existing active content for this domain and create new one
  await SupportToolContent.updateMany(
    { isActive: true, domain },
    { isActive: false }
  );

  const content = new SupportToolContent({
    tips: tips || [],
    eap: eap || [],
    hr: hr || [],
    crisis: crisis || [],
    domain,
    isActive: true,
    updatedBy: superAdminId,
    version: 1,
  });

  await content.save();

  res.status(201).json({
    success: true,
    message: "Support tool content created successfully",
    data: content,
  });
});

// Update support tool content
export const updateSupportToolContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tips, eap, hr, crisis } = req.body;
  const superAdminId = req.user?.sub || req.user?.id;

  const content = await SupportToolContent.findById(id);

  if (!content) {
    return res.status(404).json({ message: "Support tool content not found" });
  }

  // Update the content
  if (tips) content.tips = tips;
  if (eap) content.eap = eap;
  if (hr) content.hr = hr;
  if (crisis) content.crisis = crisis;
  
  content.version = (content.version || 1) + 1;
  content.updatedBy = superAdminId;

  await content.save();

  res.status(200).json({
    success: true,
    message: "Support tool content updated successfully",
    data: content,
  });
});

// Delete support tool content
export const deleteSupportToolContent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const content = await SupportToolContent.findByIdAndDelete(id);

  if (!content) {
    return res.status(404).json({ message: "Support tool content not found" });
  }

  res.status(200).json({
    success: true,
    message: "Support tool content deleted successfully",
  });
});
