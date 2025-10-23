// controllers/checkInQuestionController.js
import { CheckInQuestions } from "../models/CheckInQuestions.js";

function asStringArray(v) {
  if (Array.isArray(v))
    return v
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  if (typeof v === "string")
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

export const getCheckInQuestions = async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ message: "Domain required" });
    const items = await CheckInQuestions.find({ domain }).lean();
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to load questions" });
  }
};

export const createCheckInQuestion = async (req, res) => {
  try {
    const { domain, question, options, description, isSupport, isActive } =
      req.body || {};
    if (!domain) return res.status(400).json({ message: "Domain required" });
    if (!question || typeof question !== "string")
      return res.status(400).json({ message: "Question text required" });

    const opts = asStringArray(options);

    const exists = await CheckInQuestions.findOne({ domain, question }).lean();
    if (exists)
      return res
        .status(409)
        .json({ message: "Question already exists in this domain" });

    const doc = await CheckInQuestions.create({
      domain,
      question: question.trim(),
      options: opts,
      description: description?.trim() || undefined,
      isSupport: Boolean(isSupport),
      isActive: isActive !== false,
    });
    res.status(201).json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message || "Create failed" });
  }
};

export const updateCheckInQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { domain, question, options, description, isSupport, isActive } =
      req.body || {};
    if (!domain) return res.status(400).json({ message: "Domain required" });

    const update = {};
    if (typeof question === "string") update.question = question.trim();
    if (typeof description === "string")
      update.description = description.trim();
    if (typeof isSupport !== "undefined") update.isSupport = Boolean(isSupport);
    if (typeof isActive !== "undefined") update.isActive = Boolean(isActive);
    if (typeof options !== "undefined") update.options = asStringArray(options);

    const doc = await CheckInQuestions.findOneAndUpdate(
      { _id: id, domain },
      update,
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Question not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message || "Update failed" });
  }
};

export const deleteCheckInQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { domain } = req.body || req.query || {};
    if (!domain) return res.status(400).json({ message: "Domain required" });

    const doc = await CheckInQuestions.findOneAndDelete({ _id: id, domain });
    if (!doc) return res.status(404).json({ message: "Question not found" });
    res.json({ message: "Deleted", id: doc._id });
  } catch (e) {
    res.status(500).json({ message: e.message || "Delete failed" });
  }
};

export const getCheckInQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ message: "Domain required" });

    const doc = await CheckInQuestions.findOne({ _id: id, domain }).lean();
    if (!doc) return res.status(404).json({ message: "Question not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message || "Fetch failed" });
  }
};

export const getCheckInQuestionByQuestion = async (req, res) => {
  try {
    const { question } = req.params;
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ message: "Domain required" });

    const doc = await CheckInQuestions.findOne({ domain, question }).lean();
    if (!doc) return res.status(404).json({ message: "Question not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message || "Fetch failed" });
  }
};
