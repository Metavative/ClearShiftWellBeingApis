import dayjs from "dayjs";
import CheckInResponse from "../models/CheckInResponse.js";
import PDFDocument from "pdfkit";

function answerSeverity(option, isPositive = true) {
  const t = String(option || "").toLowerCase();
  const yes = t.includes("yes");
  const no = t.includes("no");
  const neutral = t.includes("neutral") || t.includes("prefer not");

  if (neutral) return "amber";
  if (yes) return isPositive ? "green" : "red";
  if (no) return isPositive ? "red" : "green";
  return "amber";
}

export async function weeklyReport(req, res) {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ message: "domain required" });

  const end = dayjs().endOf("isoWeek");
  const start = end.subtract(6, "day").startOf("day");

  const rows = await CheckInResponse.find({
    domain,
    createdAt: { $gte: start.toDate(), $lte: end.toDate() },
  }).lean();

  let red = 0,
    amber = 0,
    green = 0,
    total = 0;
  const themes = {};

  for (const r of rows) {
    total += 1;
    let sev = "amber";
    for (const a of r.answers || []) {
      const s = answerSeverity(a.option, a.isPositive ?? true);
      if (s === "red") {
        sev = "red";
        break;
      }
      if (s === "green" && sev !== "red") sev = "green";
    }
    if (sev === "red") red++;
    else if (sev === "green") green++;
    else amber++;

    // crude theme extraction from free-text description
    for (const a of r.answers || []) {
      const d = (a.description || "").toLowerCase();
      if (!d) continue;
      [
        "fatigue",
        "workload",
        "support",
        "stress",
        "communication",
        "sleep",
        "manager",
      ].forEach((k) => {
        if (d.includes(k)) themes[k] = (themes[k] || 0) + 1;
      });
    }
  }

  const sortedThemes = Object.entries(themes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => ({ topic: k, count: v }));

  res.json({
    domain,
    weekEnding: end.format("YYYY-MM-DD"),
    window: { start: start.toISOString(), end: end.toISOString() },
    total,
    red,
    amber,
    green,
    themes: sortedThemes,
  });
}

export async function weeklyReportPdf(req, res) {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ message: "domain required" });

  // Reuse JSON aggregation
  req.query.limit = undefined;
  const end = dayjs().endOf("isoWeek");
  const start = end.subtract(6, "day").startOf("day");

  const rows = await CheckInResponse.find({
    domain,
    createdAt: { $gte: start.toDate(), $lte: end.toDate() },
  }).lean();

  let red = 0,
    amber = 0,
    green = 0,
    total = 0;
  for (const r of rows) {
    total += 1;
    let sev = "amber";
    for (const a of r.answers || []) {
      const s = answerSeverity(a.option, a.isPositive ?? true);
      if (s === "red") {
        sev = "red";
        break;
      }
      if (s === "green" && sev !== "red") sev = "green";
    }
    if (sev === "red") red++;
    else if (sev === "green") green++;
    else amber++;
  }

  // Generate PDF
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="weekly-${domain}-${end.format("YYYYMMDD")}.pdf"`
  );

  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(res);

  doc.fontSize(20).text("Weekly Wellbeing Summary", { align: "left" });
  doc
    .moveDown(0.2)
    .fontSize(12)
    .fillColor("#666")
    .text(`Domain: ${domain}`)
    .text(`Week Ending: ${end.format("MMMM D, YYYY")}`)
    .moveDown();

  doc
    .fillColor("#000")
    .fontSize(14)
    .text("Totals", { underline: true })
    .moveDown(0.5);
  doc.text(`Total Submissions: ${total}`);
  doc.fillColor("#DC3545").text(`Red (Concern): ${red}`);
  doc.fillColor("#FFC107").text(`Amber (Caution): ${amber}`);
  doc.fillColor("#28A745").text(`Green (Good): ${green}`);
  doc.fillColor("#000").moveDown();

  doc.fontSize(14).text("Notes", { underline: true }).moveDown(0.5);
  doc
    .fontSize(12)
    .text("• This report is anonymized and contains no personal data.");
  doc.text("• Auto-sent weekly to employer wellbeing lead.");

  doc.end();
}
