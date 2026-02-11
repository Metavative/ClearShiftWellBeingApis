import { User } from "../models/User.js";
import { VerificationCode } from "../models/VerificationCode.js";
import AdminUser from "../models/AdminUser.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendEmail } from "../utils/sendEmail.js";

// helper
const make5 = () => String(crypto.randomInt(10000, 100000));
const hash = (v) => bcrypt.hash(v, Number(process.env.TOKEN_SALT_ROUNDS || 12));
const normalizeDomain = (v = "") => String(v || "").trim().toLowerCase();

/**
 * GET /company/users?domain=metavative.com&q?=&role?=employee
 */
export const listCompanyUsers = async (req, res) => {
  const { domain, q, role } = req.query || {};
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain)
    return res.status(400).json({ message: "domain required" });

  const where = { domain: normalizedDomain };
  if (role) where.role = role;
  if (q) {
    where.$or = [{ email: new RegExp(q, "i") }, { name: new RegExp(q, "i") }];
  }

  const items = await User.find(where).sort("-createdAt").lean();
  res.json(items);
};

/**
 * POST /company/users
 * body: { domain, name, email, role?="employee" }
 * Behavior:
 *  - creates user with role (employee by default) & domain
 *  - generates a 5-digit verification code for email verification flow you already have
 *  - sends a "set your password" / verify email email
 */
export const createCompanyUser = async (req, res) => {
  const { domain, name, email, role = "employee" } = req.body || {};
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain || !email)
    return res.status(400).json({ message: "domain and email required" });

  let user = await User.findOne({ email });
  if (user) return res.status(409).json({ message: "Email already exists" });

  // Enforce tenant seat limit configured by super admin.
  const domainAdmin = await AdminUser.findOne({
    domain: normalizedDomain,
    licenseStatus: "active",
  })
    .sort("-createdAt")
    .lean();
  const seatLimit =
    typeof domainAdmin?.seatLimit === "number" && domainAdmin.seatLimit > 0
      ? domainAdmin.seatLimit
      : null;
  if (seatLimit) {
    const usedSeats = await User.countDocuments({ domain: normalizedDomain });
    if (usedSeats >= seatLimit) {
      return res.status(409).json({
        message: `Seat limit reached (${usedSeats}/${seatLimit}). Please contact super admin.`,
        code: "SEAT_LIMIT_REACHED",
        seatLimit,
        usedSeats,
      });
    }
  }

  user = await User.create({
    domain: normalizedDomain,
    name: name || "",
    email,
    role,
    emailVerified: false,
  });

  // issue verification code (reusing your auth flow)
  await VerificationCode.deleteMany({ userId: user._id });
  const raw = make5();
  const codeHash = await hash(raw);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await VerificationCode.create({ userId: user._id, codeHash, expiresAt });

  await sendEmail({
    to: user.email,
    subject: `You're invited to ClearShiftWellbeing`,
    html: `
      <p>Hi ${name || "there"},</p>
      <p>Your company has created an account for you.</p>
      <p>Your email verification code is <b style="font-size:20px;letter-spacing:3px;">${raw}</b>.</p>
      <p>Enter this code in the app to verify, then set your password to sign in.</p>
    `,
  });

  res.status(201).json({ message: "User invited", id: user._id });
};

/**
 * PATCH /company/users/:id
 * body: { name?, role?, emailVerified?, password? }
 */
export const updateCompanyUser = async (req, res) => {
  const { id } = req.params;
  const { domain, name, role, emailVerified, password } = req.body || {};
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain)
    return res.status(400).json({ message: "domain required" });

  const user = await User.findOne({ _id: id, domain: normalizedDomain }).select(
    "+password"
  );
  if (!user) return res.status(404).json({ message: "User not found" });

  if (typeof name === "string") user.name = name.trim();
  if (role && ["employee", "admin"].includes(role)) user.role = role;
  if (typeof emailVerified === "boolean") user.emailVerified = emailVerified;
  if (typeof password === "string" && password.length >= 8)
    user.password = password;
  await user.save();

  res.json({ message: "Updated" });
};

/**
 * DELETE /company/users/:id?domain=metavative.com
 */
export const deleteCompanyUser = async (req, res) => {
  const { id } = req.params;
  const { domain } = req.query || {};
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain)
    return res.status(400).json({ message: "domain required" });

  const doc = await User.findOneAndDelete({ _id: id, domain: normalizedDomain });
  if (!doc) return res.status(404).json({ message: "User not found" });
  res.json({ message: "Deleted", id: doc._id });
};
