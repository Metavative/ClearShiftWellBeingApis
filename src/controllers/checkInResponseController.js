// controllers/checkInResponseController.js
import CheckInQuestions from "../models/CheckInQuestions.js";
import CheckInResponse from "../models/CheckInResponse.js";
import AdminUser from "../models/AdminUser.js"; // your admin model (one admin per domain)
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

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
    const { domain, employeeId, answers = [], meta } = req.body || {};
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
      };
    });

    const doc = await CheckInResponse.create({
      domain,
      employeeId,
      answers: normalized,
      meta: meta || {},
      submittedAt: new Date(),
    });

    try {
      const admin = await AdminUser.findOne({ domain }).lean();
      if (admin?.email) {
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
            When:     ${new Date(doc.submittedAt).toLocaleString()}

            Answers:
            ${lines}
            `,
        });
      }
    } catch (e) {
      console.error("Email send failed:", e?.message);
    }

    res.json({
      message: "Submitted",
      id: doc._id,
      submittedAt: doc.submittedAt,
    });
  } catch (e) {
    return res.status(400).json({ message: e?.message || "Submission error" });
  }
};

/** GET /checkin/responses?domain=...&employeeId?=... */
export const listResponses = async (req, res) => {
  try {
    const { domain, employeeId } = req.query || {};
    if (!domain) return res.status(400).json({ message: "domain required" });

    const where = { domain };
    if (employeeId) where.employeeId = employeeId;

    const items = await CheckInResponse.find(where).sort("-submittedAt").lean();
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e?.message || "Failed to list responses" });
  }
};
