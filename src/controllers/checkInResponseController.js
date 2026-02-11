// controllers/checkInResponseController.js
import CheckInQuestions from "../models/CheckInQuestions.js";
import CheckInResponse from "../models/CheckInResponse.js";
import AdminUser from "../models/AdminUser.js"; // your admin model (one admin per domain)
import nodemailer from "nodemailer";

const SMTP_CONNECTION_TIMEOUT_MS = Number(
  process.env.SMTP_CONNECTION_TIMEOUT_MS || 5000
);
const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 8000);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
  greetingTimeout: SMTP_CONNECTION_TIMEOUT_MS,
  socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

function optionMeansSupport(option = "") {
  const text = String(option || "").toLowerCase().trim();
  if (!text) return false;
  if (text.includes("prefer not")) return false;
  if (text.includes("no")) return false;
  return (
    text.includes("yes") ||
    text.includes("help") ||
    text.includes("support") ||
    text.includes("need") ||
    text.includes("contact")
  );
}

function queueAdminCheckinEmail({ domain, employeeId, submittedAt, normalized }) {
  setImmediate(async () => {
    try {
      const admin = await AdminUser.findOne({ domain }).lean();
      if (!admin?.email) return;

      const lines = normalized
        .map(
          (a, i) =>
            `${i + 1}. ${a.question}\n   → ${a.option}${
              a.description ? `\n   • Note: ${a.description}` : ""
            }`
        )
        .join("\n\n");

      await transporter.sendMail({
        from: process.env.SMTP_FROM || "no-reply@yourapp.com",
        to: admin.email,
        subject: `New Check-In — ${employeeId} (${domain})`,
        text: `A new check-in was submitted.

            Employee: ${employeeId}
            Domain:   ${domain}
            When:     ${new Date(submittedAt).toLocaleString()}

            Answers:
            ${lines}
            `,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Email send failed:", e?.message);
    }
  });
}

/**
 * POST /checkin/responses
 * body: {
 *   domain, employeeId,
 *   answers: [{ questionId, option, description? }],
 *   meta?
 * }
 */
export const submitCheckIn = async (req, res) => {
  try {
    const {
      domain,
      employeeId,
      answers = [],
      meta,
      supportRequested: supportRequestedInput,
    } = req.body || {};
    if (
      !domain ||
      !employeeId ||
      !Array.isArray(answers) ||
      answers.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "domain, employeeId and answers are required." });
    }

    // Pull questions for snapshot + validation (domain-scoped)
    const ids = answers.map((a) => a.questionId);
    const questions = await CheckInQuestions.find({
      _id: { $in: ids },
      domain,
      isActive: true,
    }).lean();
    const qmap = new Map(questions.map((q) => [String(q._id), q]));

    const normalized = answers.map((a) => {
      const q = qmap.get(String(a.questionId));
      if (!q) throw new Error("Question not found or not in this domain");
      // Validate option exists if options are defined
      if (
        Array.isArray(q.options) &&
        q.options.length &&
        !q.options.includes(a.option)
      ) {
        throw new Error(`Invalid option for question: ${q.question}`);
      }
      return {
        questionId: q._id,
        question: q.question,
        option: a.option,
        description: a.description || "",
        isPositive: q.isPositive ?? true,
        isSupport: q.isSupport ?? false,
      };
    });

    const supportRequested =
      typeof supportRequestedInput === "boolean"
        ? supportRequestedInput
        : normalized.some((a) => a.isSupport && optionMeansSupport(a.option));

    const doc = await CheckInResponse.create({
      domain,
      employeeId,
      answers: normalized,
      supportRequested,
      meta: meta || {},
      submittedAt: new Date(),
    });

    // Do not block API response on SMTP/email latency.
    queueAdminCheckinEmail({
      domain,
      employeeId,
      submittedAt: doc.submittedAt,
      normalized,
    });

    res.json({
      message: "Submitted",
      id: doc._id,
      submittedAt: doc.submittedAt,
      supportRequested: doc.supportRequested,
    });
  } catch (e) {
    return res.status(400).json({ message: e?.message || "Submission error" });
  }
};

/** GET /checkin/responses?domain=...&employeeId?=... */
export const listResponses = async (req, res) => {
  try {
    const { domain, employeeId, start, end, limit } = req.query || {};
    if (!domain) return res.status(400).json({ message: "domain required" });

    const where = { domain };
    if (employeeId) where.employeeId = employeeId;
    if (start || end) {
      where.submittedAt = {};
      if (start) where.submittedAt.$gte = new Date(start);
      if (end) where.submittedAt.$lte = new Date(end);
    }

    const limitNum = Math.min(500, Math.max(1, Number(limit) || 100));
    const items = await CheckInResponse.find(where)
      .sort("-submittedAt")
      .limit(limitNum)
      .lean();
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e?.message || "Failed to list responses" });
  }
};

/** PATCH /checkin-responses/:id/ack */
export const updateAckStatus = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { acked } = req.body || {};
    if (typeof acked !== "boolean") {
      return res.status(400).json({ message: "acked boolean is required" });
    }

    const doc = await CheckInResponse.findByIdAndUpdate(
      id,
      { acked, ackedAt: acked ? new Date() : null },
      { new: true }
    ).lean();

    if (!doc) return res.status(404).json({ message: "Response not found" });
    res.json({
      id: doc._id,
      acked: doc.acked,
      ackedAt: doc.ackedAt,
    });
  } catch (e) {
    res.status(500).json({ message: e?.message || "Failed to update ack" });
  }
};
