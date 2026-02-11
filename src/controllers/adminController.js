import AdminUser from "../models/AdminUser.js";
import DomainVerification from "../models/DomainVerification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateLicenseKey } from "../utils/license.js";

// simple validators
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^[0-9+\-() ]{6,20}$/;

function parseSeatLimit(input) {
  if (input === undefined || input === null || input === "") return null;
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1) return NaN;
  return n;
}

export const createAdmin = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, domain, seatLimit } =
    req.body || {};
  if (!firstName || !lastName || !email || !domain) {
    return res
      .status(400)
      .json({ message: "firstName, lastName, email, domain are required" });
  }
  if (!emailRe.test(email))
    return res.status(400).json({ message: "Invalid email" });
  if (phone && !phoneRe.test(phone))
    return res.status(400).json({ message: "Invalid phone number" });

  const parsedSeatLimit = parseSeatLimit(seatLimit);
  if (Number.isNaN(parsedSeatLimit)) {
    return res
      .status(400)
      .json({ message: "seatLimit must be a positive integer" });
  }

  // find verified domain
  const dom = await DomainVerification.findOne({ domain, status: "verified" });
  if (!dom) {
    return res
      .status(400)
      .json({ message: "Domain must be verified before creating admin" });
  }

  const licenseKey = generateLicenseKey(domain, email);

  const doc = await AdminUser.create({
    firstName,
    lastName,
    email,
    phone,
    domain: dom.domain,
    domainId: dom._id,
    licenseKey,
    licenseStatus: "active",
    issuedAt: new Date(),
    seatLimit: parsedSeatLimit,
    // optional: expiresAt: new Date(Date.now() + 365*864e5),
    createdBy: req.user?._id,
  });

  res.status(201).json(doc);
});

export const listAdmins = asyncHandler(async (req, res) => {
  const {
    q,
    domain,
    status,
    page = 1,
    limit = 20,
    sort = "-createdAt",
  } = req.query || {};
  const where = {};
  if (q) {
    where.$or = [
      { firstName: new RegExp(q, "i") },
      { lastName: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
      { licenseKey: new RegExp(q, "i") },
    ];
  }
  if (domain) where.domain = domain;
  if (status) where.licenseStatus = status;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const [items, total] = await Promise.all([
    AdminUser.find(where)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    AdminUser.countDocuments(where),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  });
});

export const getAdmin = asyncHandler(async (req, res) => {
  const doc = await AdminUser.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Admin not found" });
  res.json(doc);
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, seatLimit } = req.body || {};
  const doc = await AdminUser.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Admin not found" });

  if (firstName) doc.firstName = firstName;
  if (lastName) doc.lastName = lastName;
  if (email) {
    if (!emailRe.test(email))
      return res.status(400).json({ message: "Invalid email" });
    doc.email = email;
  }
  if (phone) {
    if (!phoneRe.test(phone))
      return res.status(400).json({ message: "Invalid phone number" });
    doc.phone = phone;
  }
  if (typeof seatLimit !== "undefined") {
    const parsedSeatLimit = parseSeatLimit(seatLimit);
    if (Number.isNaN(parsedSeatLimit)) {
      return res
        .status(400)
        .json({ message: "seatLimit must be a positive integer" });
    }
    doc.seatLimit = parsedSeatLimit;
  }

  doc.updatedBy = req.user?._id;
  await doc.save();
  res.json(doc);
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  const doc = await AdminUser.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: "Admin not found" });
  res.json({ message: "Deleted", id: doc._id });
});

export const rotateLicense = asyncHandler(async (req, res) => {
  const doc = await AdminUser.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Admin not found" });
  const newKey = generateLicenseKey(doc.domain, doc.email);
  doc.licenseKey = newKey;
  doc.licenseStatus = "active";
  doc.issuedAt = new Date();
  await doc.save();
  res.json({
    message: "License rotated",
    licenseKey: doc.licenseKey,
    issuedAt: doc.issuedAt,
    adminId: doc._id,
  });
});

export const revokeLicense = asyncHandler(async (req, res) => {
  const doc = await AdminUser.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Admin not found" });
  doc.licenseStatus = "revoked";
  await doc.save();
  res.json({ message: "License revoked", adminId: doc._id });
});
