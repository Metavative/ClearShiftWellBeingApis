import crypto from "crypto";
import bcrypt from "bcryptjs";
import createError from "http-errors";
import { validationResult } from "express-validator";
import { SuperAdmin } from "../models/SuperAdminLogin.js";
import { VerificationCode } from "../models/VerificationCode.js";
import { PasswordResetCode } from "../models/PasswordResetCode.js";
import { sendEmail } from "../utils/sendEmail.js";
import { env } from "../config/env.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/generateTokens.js";

// --- helpers ---
const make5DigitCode = () => String(crypto.randomInt(10000, 100000)); // 10000..99999
const hashToken = async (token) =>
  bcrypt.hash(token, Number(process.env.TOKEN_SALT_ROUNDS || 12));
function sendValidationErrors(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw createError(400, { errors: errors.array() });
}

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  let user = await SuperAdmin.findOne({ email });

  if (user) {
    if (user.emailVerified) {
      // Already verified → block
      throw createError(409, "Email already in use");
    } else {
      // Not verified yet → update name/password (optional), and re-send OTP
      user.name = name || user.name;
      if (password) user.password = password; // will re-hash
      await user.save();

      await VerificationCode.deleteMany({ userId: user._id });
      const raw = make5DigitCode();
      const codeHash = await hashToken(raw);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await VerificationCode.create({ userId: user._id, codeHash, expiresAt });

      await sendEmail({
        to: user.email,
        subject: "Your verification code",
        html: `<p>Hi ${user.name},</p><p>Your verification code is <b style="font-size:20px;letter-spacing:3px;">${raw}</b>. It expires in 10 minutes.</p>`,
      });

      return res.json({
        message: "Verification code resent. Please check your email.",
        uid: user._id,
      });
    }
  }

  // New user path
  user = await SuperAdmin.create({ name, email, password });
  await VerificationCode.deleteMany({ userId: user._id });
  const raw = make5DigitCode();
  const codeHash = await hashToken(raw);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await VerificationCode.create({ userId: user._id, codeHash, expiresAt });

  await sendEmail({
    to: user.email,
    subject: "Your verification code",
    html: `<p>Hi ${user.name},</p><p>Your verification code is <b style="font-size:20px;letter-spacing:3px;">${raw}</b>. It expires in 10 minutes.</p>`,
  });

  res.status(201).json({
    message: "Registered successfully. Please check your email to verify.",
    uid: user._id,
  });
};

export const resendVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) throw createError(400, "Email is required");

  const user = await SuperAdmin.findOne({ email });
  if (!user)
    return res.json({ message: "If that email exists, a code has been sent." });
  if (user.emailVerified)
    return res.json({ message: "Email already verified." });

  await VerificationCode.deleteMany({ userId: user._id });

  const raw = String(crypto.randomInt(10000, 100000));
  const codeHash = await bcrypt.hash(
    raw,
    Number(process.env.TOKEN_SALT_ROUNDS || 12)
  );
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await VerificationCode.create({ userId: user._id, codeHash, expiresAt });

  await sendEmail({
    to: user.email,
    subject: "Your verification code",
    html: `<p>Your verification code is <b style="font-size:20px;letter-spacing:3px;">${raw}</b>. It expires in 10 minutes.</p>`,
  });

  // For dev convenience, you can temporarily expose the code:
  if (process.env.NODE_ENV !== "production") {
    console.log("DEV resend verification code:", raw);
    return res.json({
      message: "If that email exists, a code has been sent.",
      uid: user._id,
      devCode: raw,
    });
  }

  res.json({
    message: "If that email exists, a code has been sent.",
    uid: user._id,
  });
};

// GET /auth/verify-email?token=..&uid=..
export const verifyEmail = async (req, res) => {
  const { uid, code } = req.body; // POST body
  if (!uid || !code) throw createError(400, "Code and uid are required");

  const record = await VerificationCode.findOne({ userId: uid });
  if (!record) throw createError(400, "Invalid or expired code");

  if (record.attempts >= 5) {
    await VerificationCode.deleteOne({ _id: record._id });
    throw createError(429, "Too many attempts. Request a new code.");
  }

  const ok = await bcrypt.compare(code, record.codeHash);
  if (!ok || record.expiresAt < new Date()) {
    await VerificationCode.updateOne(
      { _id: record._id },
      { $inc: { attempts: 1 } }
    );
    throw createError(400, "Invalid or expired code");
  }

  await SuperAdmin.findByIdAndUpdate(uid, { emailVerified: true });
  await VerificationCode.deleteOne({ _id: record._id });

  res.json({ message: "Email verified." });
};

// POST /auth/login
export const login = async (req, res) => {
  // sendValidationErrors(req);
  const { email, password } = req.body;
  const user = await SuperAdmin.findOne({ email }).select(
    "+password +refreshToken"
  );
  if (!user) throw createError(401, "Invalid credentials");

  const ok = await user.comparePassword(password);
  if (!ok) throw createError(401, "Invalid credentials");

  if (!user.emailVerified)
    throw createError(403, "Please verify your email before logging in.");

  const accessToken = generateAccessToken({
    sub: user._id.toString(),
    email: user.email,
  });
  const refreshToken = generateRefreshToken({ sub: user._id.toString() });

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  res
    .cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
};

// POST /auth/refresh
export const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw createError(401, "Missing refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw createError(401, "Invalid refresh token");
  }
  const user = await SuperAdmin.findById(payload.sub).select("+refreshToken");
  if (!user || user.refreshToken !== token)
    throw createError(401, "Invalid refresh token");

  const accessToken = generateAccessToken({
    sub: user._id.toString(),
    email: user.email,
  });
  res.json({ accessToken });
};

// POST /auth/logout
export const logout = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await SuperAdmin.findByIdAndUpdate(payload.sub, {
        $unset: { refreshToken: 1 },
      });
    } catch {}
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
  res.json({ message: "Logged out" });
};

// POST /auth/forgot-password
export const forgotPassword = async (req, res) => {
  // sendValidationErrors(req);
  const { email } = req.body;
  const user = await SuperAdmin.findOne({ email });
  if (!user)
    return res.json({ message: "If that email exists, a code has been sent." });

  await PasswordResetCode.deleteMany({ userId: user._id });
  const rawCode = make5DigitCode();
  const codeHash = await hashToken(rawCode);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await PasswordResetCode.create({ userId: user._id, codeHash, expiresAt });

  await sendEmail({
    to: user.email,
    subject: "Your password reset code",
    html: `<p>Your reset code is <b style="font-size:20px;letter-spacing:3px;">${rawCode}</b>.
           It expires in 10 minutes.</p>`,
  });

  res.json({
    message: "If that email exists, a code has been sent.",
    uid: user._id,
  });
};

// POST /auth/reset-password
export const resetPassword = async (req, res) => {
  // sendValidationErrors(req);
  const { uid, code, password } = req.body;
  if (!uid || !code || !password)
    throw createError(400, "uid, code, password required");

  const record = await PasswordResetCode.findOne({ userId: uid });
  if (!record) throw createError(400, "Invalid or expired code");

  if (record.attempts >= 5) {
    await PasswordResetCode.deleteOne({ _id: record._id });
    throw createError(429, "Too many attempts. Request a new code.");
  }

  const ok = await bcrypt.compare(code, record.codeHash);
  if (!ok || record.expiresAt < new Date()) {
    await PasswordResetCode.updateOne(
      { _id: record._id },
      { $inc: { attempts: 1 } }
    );
    throw createError(400, "Invalid or expired code");
  }

  const user = await SuperAdmin.findById(uid).select("+password");
  user.password = password;
  await user.save();
  await PasswordResetCode.deleteOne({ _id: record._id });

  res.json({ message: "Password has been reset. You can now log in." });
};

export const selectRole = async (req, res) => {
  const { uid, role } = req.body;
  if (!uid || !role) throw createError(400, "uid and role are required");
  if (!["super_admin", "admin"].includes(role))
    throw createError(400, "Invalid role");
  const user = await SuperAdmin.findById(uid);
  if (!user) throw createError(404, "User not found");
  if (!user.emailVerified) throw createError(403, "Verify email first");
  user.role = role;
  await user.save({ validateBeforeSave: false });
  res.json({ message: "Role selected", role: user.role });
};
