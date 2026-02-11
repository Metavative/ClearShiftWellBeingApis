import AdminUser from "../models/AdminUser.js";
import { SupportToolContent } from "../models/SupportToolContent.js";
import SupportRequest from "../models/SupportRequest.js";
import { sendEmail } from "../utils/sendEmail.js";

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const VALID_STATUSES = ["new", "in_progress", "resolved"];
const normalizeDomain = (v = "") => String(v || "").trim().toLowerCase();

function extractEmails(values = []) {
  const found = new Set();
  for (const value of values) {
    const text = String(value || "");
    const matches = text.match(emailRegex) || [];
    for (const match of matches) {
      found.add(match.toLowerCase());
    }
  }
  return [...found];
}

export const submitSupportRequest = async (req, res) => {
  try {
    const {
      domain,
      employeeId = "",
      supportType = "hr",
      message = "",
      contact = {},
      checkinId = "",
    } = req.body || {};

    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return res.status(400).json({ message: "domain is required" });
    }

    const activeSupport = await SupportToolContent.findOne({
      domain: normalizedDomain,
      isActive: true,
    }).lean();

    const candidateContacts = [];
    if (activeSupport) {
      if (supportType === "crisis") {
        candidateContacts.push(...(activeSupport.crisis || []));
      } else if (supportType === "eap") {
        candidateContacts.push(...(activeSupport.eap || []));
      } else {
        candidateContacts.push(...(activeSupport.hr || []));
      }
      candidateContacts.push(...(activeSupport.hr || []));
      candidateContacts.push(...(activeSupport.eap || []));
      candidateContacts.push(...(activeSupport.crisis || []));
    }

    const toolEmails = extractEmails(candidateContacts);
    const adminEmails = (
      await AdminUser.find({ domain: normalizedDomain, licenseStatus: "active" })
        .select("email")
        .lean()
    )
      .map((a) => String(a.email || "").toLowerCase())
      .filter(Boolean);

    const recipients = [...new Set([...toolEmails, ...adminEmails])];
    if (process.env.SUPPORT_FALLBACK_EMAIL) {
      recipients.push(process.env.SUPPORT_FALLBACK_EMAIL.toLowerCase());
    }

    const finalRecipients = [...new Set(recipients)].filter(Boolean);
    if (!finalRecipients.length) {
      return res.status(422).json({
        message:
          "No support routing contact configured for this domain. Configure HR/EAP emails first.",
      });
    }

    const safeMessage = String(message || "").trim();
    const name = String(contact?.name || "").trim();
    const email = String(contact?.email || "").trim();
    const phone = String(contact?.phone || "").trim();

    const html = `
      <h2>Support request submitted</h2>
      <p><b>Domain:</b> ${normalizedDomain}</p>
      <p><b>Support type:</b> ${supportType}</p>
      <p><b>Check-in reference:</b> ${checkinId || "N/A"}</p>
      <p><b>Employee reference:</b> ${employeeId || "Anonymous"}</p>
      <h3>Contact details (optional)</h3>
      <p><b>Name:</b> ${name || "Not provided"}</p>
      <p><b>Email:</b> ${email || "Not provided"}</p>
      <p><b>Phone:</b> ${phone || "Not provided"}</p>
      <h3>User message</h3>
      <p>${safeMessage ? safeMessage.replace(/\n/g, "<br/>") : "No additional message"}</p>
    `;

    await sendEmail({
      to: finalRecipients.join(","),
      subject: `Support request - ${normalizedDomain}`,
      html,
    });

    const created = await SupportRequest.create({
      domain: normalizedDomain,
      employeeId: String(employeeId || "").trim(),
      supportType: ["hr", "eap", "crisis"].includes(String(supportType))
        ? String(supportType)
        : "other",
      message: safeMessage,
      contact: {
        name,
        email,
        phone,
      },
      checkinId: String(checkinId || "").trim(),
      routedTo: finalRecipients.length,
      submittedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Support request sent successfully",
      id: created._id,
      routedTo: finalRecipients.length,
    });
  } catch (e) {
    return res.status(500).json({
      message: e?.message || "Failed to send support request",
    });
  }
};

export const listSupportRequests = async (req, res) => {
  try {
    const { domain, employeeId, status, limit } = req.query || {};
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return res.status(400).json({ message: "domain is required" });
    }

    const where = { domain: normalizedDomain };
    if (employeeId) where.employeeId = String(employeeId).trim();
    if (status && VALID_STATUSES.includes(String(status))) {
      where.status = String(status);
    }

    const cap = Math.min(500, Math.max(1, Number(limit) || 100));
    const items = await SupportRequest.find(where)
      .sort("-submittedAt")
      .limit(cap)
      .lean();

    return res.status(200).json({
      success: true,
      items,
      count: items.length,
    });
  } catch (e) {
    return res.status(500).json({
      message: e?.message || "Failed to load support requests",
    });
  }
};

export const updateSupportRequestStatus = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { domain, status } = req.body || {};
    const normalizedDomain = normalizeDomain(domain);
    const nextStatus = String(status || "").trim();

    if (!id) return res.status(400).json({ message: "id is required" });
    if (!normalizedDomain) {
      return res.status(400).json({ message: "domain is required" });
    }
    if (!VALID_STATUSES.includes(nextStatus)) {
      return res.status(400).json({
        message: "status must be one of: new, in_progress, resolved",
      });
    }

    const patch = {
      status: nextStatus,
      statusUpdatedAt: new Date(),
      resolvedAt: nextStatus === "resolved" ? new Date() : null,
    };

    const updated = await SupportRequest.findOneAndUpdate(
      { _id: id, domain: normalizedDomain },
      patch,
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        message: "Support request not found for this domain",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated",
      item: updated,
    });
  } catch (e) {
    return res.status(500).json({
      message: e?.message || "Failed to update support request status",
    });
  }
};
