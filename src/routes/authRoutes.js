import { Router } from "express";
import { body } from "express-validator";
import { authLimiter, sensitiveLimiter } from "../middleware/rateLimiters.js";
import {
  register,
  verifyEmail,
  resendVerification,
  login,
  refresh,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { checkEmailStatus } from "../controllers/authController.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  [body("email").isEmail().normalizeEmail()],
  register
);

router.post(
  "/verify-email",
  sensitiveLimiter,
  [body("uid").isString(), body("code").isLength({ min: 5, max: 5 })],
  verifyEmail
);

router.post(
  "/resend-verification",
  sensitiveLimiter,
  [body("email").isEmail().normalizeEmail()],
  resendVerification
);

router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 8 }),
  ],
  login
);

router.post("/refresh", refresh);

router.get("/me", requireAuth, async (req, res) => {
  const u = await User.findById(req.user.sub).lean();
  if (!u) return res.status(404).json({ message: "User not found" });
  res.json({
    user: {
      id: u._id,
      email: u.email,
      emailVerified: u.emailVerified,
    },
  });
});

router.get("/status", checkEmailStatus);

export default router;
