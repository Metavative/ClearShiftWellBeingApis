import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import AdminUser from "../models/AdminUser.js";
import WeeklyReportDispatch from "../models/WeeklyReportDispatch.js";
import { buildWeeklySummary } from "../controllers/reportController.js";
import { sendEmail } from "../utils/sendEmail.js";

dayjs.extend(utc);

const DISPATCH_INTERVAL_MS = Number(
  process.env.WEEKLY_REPORT_DISPATCH_INTERVAL_MS || 30 * 60 * 1000
);

function inDispatchWindow(now = new Date()) {
  const day = now.getUTCDay(); // Monday = 1
  const hour = now.getUTCHours();
  return day === 1 && hour >= 8 && hour < 12;
}

function previousWeekRange() {
  const end = dayjs().utc().subtract(1, "day").endOf("day");
  const start = end.subtract(6, "day").startOf("day");
  return { start: start.toISOString(), end: end.toISOString() };
}

async function dispatchForDomain(domain, range) {
  const summary = await buildWeeklySummary(domain, range);

  const already = await WeeklyReportDispatch.findOne({
    domain,
    weekEnding: summary.weekEnding,
  }).lean();
  if (already) return { skipped: true, reason: "already_sent" };

  const recipients = (
    await AdminUser.find({ domain, licenseStatus: "active" })
      .select("email")
      .lean()
  )
    .map((a) => String(a.email || "").toLowerCase())
    .filter(Boolean);

  const uniqueRecipients = [...new Set(recipients)];
  if (!uniqueRecipients.length) return { skipped: true, reason: "no_recipients" };

  const html = `
    <h2>Weekly Wellbeing Summary</h2>
    <p><b>Domain:</b> ${summary.domain}</p>
    <p><b>Week Ending:</b> ${summary.weekEnding}</p>
    <ul>
      <li><b>Total submissions:</b> ${summary.total}</li>
      <li><b>Red:</b> ${summary.red}</li>
      <li><b>Amber:</b> ${summary.amber}</li>
      <li><b>Green:</b> ${summary.green}</li>
    </ul>
    <h3>Top 3 themes</h3>
    <ul>
      ${
        summary.themes.length
          ? summary.themes.map((t) => `<li>${t.topic}: ${t.count}</li>`).join("")
          : "<li>No recurring theme extracted this week.</li>"
      }
    </ul>
    <p><i>This summary is anonymized and excludes personal identifiers.</i></p>
  `;

  await sendEmail({
    to: uniqueRecipients.join(","),
    subject: `Weekly wellbeing summary - ${summary.domain} - ${summary.weekEnding}`,
    html,
  });

  await WeeklyReportDispatch.create({
    domain,
    weekEnding: summary.weekEnding,
    recipients: uniqueRecipients,
  });

  return { skipped: false, recipients: uniqueRecipients.length };
}

export async function runWeeklyDispatchOnce() {
  const activeDomains = await AdminUser.distinct("domain", {
    licenseStatus: "active",
  });
  if (!activeDomains.length) return;

  const range = previousWeekRange();
  for (const domain of activeDomains) {
    try {
      await dispatchForDomain(domain, range);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[weekly-report-job] dispatch failed", domain, e?.message);
    }
  }
}

export function startWeeklyReportJob() {
  if (String(process.env.ENABLE_WEEKLY_REPORT_JOB || "true") !== "true") return;
  setInterval(async () => {
    try {
      if (!inDispatchWindow()) return;
      await runWeeklyDispatchOnce();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[weekly-report-job] run failed", e?.message);
    }
  }, DISPATCH_INTERVAL_MS);
}
