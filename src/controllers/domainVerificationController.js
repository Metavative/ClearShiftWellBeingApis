import { Resolver } from "node:dns/promises";
import DomainVerification from "../models/DomainVerification.js";
import { asyncHandler } from "../utils/asyncHandler.js"; // you already have this
import {
  VERIFY_HOST_PREFIX,
  DEFAULT_TTL,
  VERIFICATION_TTL_DAYS,
} from "../config/env.js";

// very light domain check (keeps it simple)
const domainRegex = /^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[A-Za-z]{2,}$/;

function randomToken() {
  const body = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `gp-verify=${body}`;
}

/**
 * POST /domains/verify/initiate
 * body: { domain, ttl? }
 * returns: { host, value, ttl, fqdn, recordType }
 */
export const initiateVerification = asyncHandler(async (req, res) => {
  const { domain, ttl } = req.body || {};
  if (!domain || !domainRegex.test(domain)) {
    return res
      .status(400)
      .json({ message: "Provide a valid domain like example.com" });
  }

  const host = VERIFY_HOST_PREFIX || "_gp-verify";
  const value = randomToken();
  const finalTtl = Number(ttl) || Number(DEFAULT_TTL) || 3600;

  const expiresAt = new Date(
    Date.now() + (VERIFICATION_TTL_DAYS || 7) * 24 * 60 * 60 * 1000
  );

  const doc = await DomainVerification.findOneAndUpdate(
    { domain },
    {
      domain,
      host,
      ttl: finalTtl,
      token: value,
      status: "pending",
      verifiedAt: null,
      lastCheckedAt: null,
      attempts: 0,
      expiresAt,
      // optionally store auth context:
      companyId: req.user?.companyId || undefined,
      createdBy: req.user?._id || undefined,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return res.json({
    message:
      "TXT record generated. Add this to your DNS and then run the check endpoint.",
    recordType: "TXT",
    host,
    value,
    ttl: finalTtl,
    fqdn: `${host}.${domain}`,
    domain: doc.domain,
    expiresAt: doc.expiresAt,
  });
});

/**
 * GET /domains/verify/check?domain=example.com
 * returns current status
 */
export const checkVerification = asyncHandler(async (req, res) => {
  const { domain } = req.query || {};
  if (!domain || !domainRegex.test(domain)) {
    return res
      .status(400)
      .json({ message: "Provide a valid domain like example.com" });
  }

  const doc = await DomainVerification.findOne({ domain });
  if (!doc)
    return res
      .status(404)
      .json({ message: "No verification found. Initiate first." });
  if (doc.expiresAt && doc.expiresAt < new Date()) {
    return res
      .status(410)
      .json({ message: "Token expired. Initiate a new verification." });
  }

  const fqdn = `${doc.host}.${doc.domain}`;

  // Use known-good resolvers to avoid stale ISP cache
  const r = new Resolver();
  r.setServers(["8.8.8.8", "1.1.1.1"]);

  let matched = false;
  let rawAnswers = [];
  let normalized = [];
  let error = null;

  try {
    const answers = await r.resolveTxt(fqdn); // string[][]
    rawAnswers = answers.map((parts) => parts); // keep original chunks for debugging
    const flattened = answers.map((parts) => parts.join("")); // join chunks
    normalized = flattened.map((s) => s.trim().replace(/^"|"$/g, "")); // strip wrapping quotes
    matched = normalized.some((s) => s === doc.token || s.includes(doc.token));
  } catch (err) {
    error = { name: err.name, code: err.code, message: err.message };
  }

  doc.attempts += 1;
  doc.lastCheckedAt = new Date();

  if (matched) {
    doc.status = "verified";
    doc.verifiedAt = new Date();
    await doc.save();
    return res.json({
      status: "verified",
      domain: doc.domain,
      fqdn,
      token: doc.token,
      answers: normalized,
      verifiedAt: doc.verifiedAt,
    });
  }

  await doc.save();
  return res.json({
    status: doc.status, // likely "pending"
    domain: doc.domain,
    fqdn,
    expectedToken: doc.token,
    answers: normalized, // what the server actually saw
    rawAnswers, // chunked view (for debugging)
    resolverError: error, // only present if a DNS error occurred
    note: "TXT not found via server’s resolvers (may be caching).",
  });
});

export const previewVerification = asyncHandler(async (req, res) => {
  const { domain, ttl } = req.body || {};
  if (!domain || !domainRegex.test(domain)) {
    return res
      .status(400)
      .json({ message: "Provide a valid domain like example.com" });
  }
  const host = VERIFY_HOST_PREFIX || "_gp-verify";
  const value = randomToken();
  const finalTtl = Number(ttl) || Number(DEFAULT_TTL) || 3600;

  return res.json({
    recordType: "TXT",
    host,
    value,
    ttl: finalTtl,
    fqdn: `${host}.${domain}`,
    domain,
  });
});

/**
 * Optional: admin list or reset
 * GET /domains
 */
export const listDomains = asyncHandler(async (req, res) => {
  const {
    status,
    q,
    page = 1,
    limit = 20,
    sort = "-createdAt", // default newest first
  } = req.query;

  const where = {};
  if (status) where.status = status; // 'pending' | 'verified' | 'failed'
  if (q) {
    where.$or = [{ domain: new RegExp(q, "i") }, { token: new RegExp(q, "i") }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    DomainVerification.find(where)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    DomainVerification.countDocuments(where),
  ]);

  res.json({
    items,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum),
  });
});

export const getDomain = asyncHandler(async (req, res) => {
  const doc = await DomainVerification.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Domain not found" });
  res.json(doc);
});

export const updateDomain = asyncHandler(async (req, res) => {
  const { domain, host, ttl } = req.body || {};
  const doc = await DomainVerification.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Domain not found" });

  let changed = false;

  if (typeof domain === "string") {
    if (!domainRegex.test(domain)) {
      return res
        .status(400)
        .json({ message: "Enter a valid domain like example.com" });
    }
    if (domain !== doc.domain) {
      doc.domain = domain;
      changed = true;
    }
  }

  if (typeof host === "string" && host && host !== doc.host) {
    doc.host = host;
    changed = true;
  }

  if (typeof ttl !== "undefined") {
    const ttlNum = Number(ttl);
    if (!Number.isFinite(ttlNum) || ttlNum <= 0) {
      return res.status(400).json({ message: "TTL must be a positive number" });
    }
    doc.ttl = ttlNum;
    changed = true;
  }

  if (changed) {
    // reset verification when essentials change
    doc.token = randomToken();
    doc.status = "pending";
    doc.verifiedAt = null;
    doc.lastCheckedAt = null;
    doc.attempts = 0;
    doc.expiresAt = new Date(
      Date.now() + (VERIFICATION_TTL_DAYS || 7) * 86400000
    );
  }

  await doc.save();
  res.json(doc);
});

export const deleteDomain = asyncHandler(async (req, res) => {
  const doc = await DomainVerification.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: "Domain not found" });
  res.json({ message: "Deleted", id: doc._id });
});

export const rotateToken = asyncHandler(async (req, res) => {
  const doc = await DomainVerification.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Domain not found" });

  doc.token = randomToken();
  doc.status = "pending";
  doc.verifiedAt = null;
  doc.lastCheckedAt = null;
  doc.attempts = 0;
  doc.expiresAt = new Date(
    Date.now() + (VERIFICATION_TTL_DAYS || 7) * 86400000
  );

  await doc.save();
  res.json({
    message: "Token rotated. Add the new TXT and verify again.",
    recordType: "TXT",
    host: doc.host,
    value: doc.token,
    ttl: doc.ttl,
    fqdn: `${doc.host}.${doc.domain}`,
    domain: doc.domain,
    expiresAt: doc.expiresAt,
  });
});
