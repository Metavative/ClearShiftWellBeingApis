import DomainVerification from "../models/DomainVerification.js";
import AdminUser from "../models/AdminUser.js";

export async function licenseGuard(req, res, next) {
  try {
    // derive tenant domain from Host or custom header
    const host = (req.headers["x-tenant-domain"] || req.headers.host || "")
      .toString()
      .toLowerCase();
    const domain = host
      .replace(/^https?:\/\//, "")
      .split(":")[0]
      .split("/")[0]; // bare domain

    const dom = await DomainVerification.findOne({ domain });
    if (!dom || dom.status !== "verified") {
      return res.status(403).json({ message: "Domain not verified." });
    }

    // require at least one active license for this domain
    const hasActive = await AdminUser.exists({
      domain,
      licenseStatus: "active",
    });
    if (!hasActive) {
      return res
        .status(403)
        .json({ message: "No active license for this domain." });
    }

    // attach tenant context
    req.tenant = { domain, domainId: dom._id };
    next();
  } catch (e) {
    next(e);
  }
}
