import crypto from "crypto";

/**
 * Deterministic-ish + random license string.
 * Example: csw-lic-ABCD-1234-EFGH-5678
 */
export function generateLicenseKey(domain, email) {
  const rand = crypto.randomBytes(8).toString("hex"); // 16 chars
  const seed = crypto
    .createHash("sha256")
    .update(`${domain}:${email}:${rand}`)
    .digest("base64url");
  const take = (s, n) =>
    s
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, n);

  const parts = [
    take(seed, 4),
    take(seed.slice(4), 4),
    take(seed.slice(8), 4),
    take(seed.slice(12), 4),
  ];
  return `csw-lic-${parts.join("-")}`;
}
