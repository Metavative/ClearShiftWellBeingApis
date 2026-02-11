import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import isoWeek from "dayjs/plugin/isoWeek.js";
import CheckInResponse from "../models/CheckInResponse.js";
import AdminUser from "../models/AdminUser.js";
import PDFDocument from "pdfkit";
import { sendEmail } from "../utils/sendEmail.js";

dayjs.extend(utc);
dayjs.extend(isoWeek);

function answerSeverity(option = "", isPositive = true) {
  const t = String(option || "").toLowerCase();
  const yes = t.includes("yes");
  const no = t.includes("no");
  const neutral = t.includes("neutral") || t.includes("prefer not");

  if (neutral) return "amber";
  if (yes) return isPositive ? "green" : "red";
  if (no) return isPositive ? "red" : "green";
  return "amber";
}

const THEME_KEYWORDS = [
  "fatigue",
  "workload",
  "support",
  "stress",
  "communication",
  "sleep",
  "manager",
  "safety",
  "burnout",
  "team",
];

function collectThemes(answer = {}, counters = {}) {
  const source = `${answer.question || ""} ${answer.description || ""}`.toLowerCase();
  for (const key of THEME_KEYWORDS) {
    if (source.includes(key)) counters[key] = (counters[key] || 0) + 1;
  }
}

async function buildWeeklySummary(domain, { start, end } = {}) {
  const endAt = end ? dayjs(end).endOf("day") : dayjs().endOf("isoWeek");
  const startAt = start
    ? dayjs(start).startOf("day")
    : endAt.subtract(6, "day").startOf("day");

  const rows = await CheckInResponse.find({
    domain,
    createdAt: { $gte: startAt.toDate(), $lte: endAt.toDate() },
  }).lean();

  let red = 0;
  let amber = 0;
  let green = 0;
  let total = 0;
  const themeCounters = {};

  for (const row of rows) {
    total += 1;
    let sev = "amber";

    for (const answer of row.answers || []) {
      const s = answerSeverity(answer.option, answer.isPositive ?? true);
      if (s === "red") {
        sev = "red";
        break;
      }
      if (s === "green" && sev !== "red") sev = "green";
    }

    if (sev === "red") red += 1;
    else if (sev === "green") green += 1;
    else amber += 1;

    for (const answer of row.answers || []) collectThemes(answer, themeCounters);
  }

  const themes = Object.entries(themeCounters)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic, count]) => ({ topic, count }));

  return {
    domain,
    weekEnding: endAt.format("YYYY-MM-DD"),
    window: { start: startAt.toISOString(), end: endAt.toISOString() },
    total,
    red,
    amber,
    green,
    themes,
  };
}

export async function weeklyReport(req, res) {
  const { domain, start, end } = req.query || {};
  if (!domain) return res.status(400).json({ message: "domain required" });

  const data = await buildWeeklySummary(domain, { start, end });
  return res.json(data);
}

export async function weeklyReportPdf(req, res) {
  const { domain, start, end } = req.query || {};
  if (!domain) return res.status(400).json({ message: "domain required" });

  const data = await buildWeeklySummary(domain, { start, end });
  const weekEndLabel = dayjs(data.weekEnding).format("MMMM D, YYYY");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="weekly-${domain}-${dayjs(data.weekEnding).format(
      "YYYYMMDD"
    )}.pdf"`
  );

  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(res);

  doc.fontSize(20).text("Weekly Wellbeing Summary", { align: "left" });
  doc
    .moveDown(0.2)
    .fontSize(12)
    .fillColor("#666")
    .text(`Domain: ${data.domain}`)
    .text(`Week Ending: ${weekEndLabel}`)
    .moveDown();

  doc
    .fillColor("#000")
    .fontSize(14)
    .text("Totals", { underline: true })
    .moveDown(0.5);
  doc.text(`Total Submissions: ${data.total}`);
  doc.fillColor("#DC3545").text(`Red (Concern): ${data.red}`);
  doc.fillColor("#FFC107").text(`Amber (Caution): ${data.amber}`);
  doc.fillColor("#28A745").text(`Green (Good): ${data.green}`);
  doc.fillColor("#000").moveDown();

  doc.fontSize(14).text("Top 3 Wellbeing Themes", { underline: true }).moveDown(0.5);
  if (!data.themes.length) {
    doc.fontSize(12).text("No recurring theme extracted this week.");
  } else {
    for (const t of data.themes) {
      doc.fontSize(12).text(`- ${t.topic}: ${t.count}`);
    }
  }
  doc.moveDown();

  doc.fontSize(14).text("Notes", { underline: true }).moveDown(0.5);
  doc
    .fontSize(12)
    .text("• This report is anonymized and contains no personal data.");
  doc.text("• Auto-sent weekly to employer wellbeing lead.");

  doc.end();
}

export async function weeklyReportEmail(req, res) {
  try {
    const { domain, start, end, to } = req.body || {};
    if (!domain) return res.status(400).json({ message: "domain required" });

    const data = await buildWeeklySummary(domain, { start, end });
    const adminEmails = (
      await AdminUser.find({ domain, licenseStatus: "active" })
        .select("email")
        .lean()
    )
      .map((a) => String(a.email || "").toLowerCase())
      .filter(Boolean);

    const extraRecipients = String(to || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const recipients = [...new Set([...adminEmails, ...extraRecipients])];
    if (!recipients.length) {
      return res.status(422).json({
        message: "No recipients configured for this domain",
      });
    }

    const html = `
      <h2>Weekly Wellbeing Summary</h2>
      <p><b>Domain:</b> ${data.domain}</p>
      <p><b>Week Ending:</b> ${data.weekEnding}</p>
      <ul>
        <li><b>Total submissions:</b> ${data.total}</li>
        <li><b>Red:</b> ${data.red}</li>
        <li><b>Amber:</b> ${data.amber}</li>
        <li><b>Green:</b> ${data.green}</li>
      </ul>
      <h3>Top 3 themes</h3>
      <ul>
        ${
          data.themes.length
            ? data.themes.map((t) => `<li>${t.topic}: ${t.count}</li>`).join("")
            : "<li>No recurring theme extracted this week.</li>"
        }
      </ul>
      <p><i>This summary is anonymized and excludes personal identifiers.</i></p>
    `;

    await sendEmail({
      to: recipients.join(","),
      subject: `Weekly wellbeing summary - ${data.domain} - ${data.weekEnding}`,
      html,
    });

    return res.json({
      success: true,
      message: "Weekly report email sent",
      recipients: recipients.length,
      summary: data,
    });
  } catch (e) {
    return res.status(500).json({
      message: e?.message || "Failed to send weekly report email",
    });
  }
}

export { buildWeeklySummary };
