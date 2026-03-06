// src/cron/releaseEarnings.js
//
// Run this file as a scheduled job.
// With node-cron it can live inside your Express app (index.js).
// With a cloud scheduler (Render cron jobs, Heroku Scheduler) run it standalone.
//
// Usage inside index.js:
//   require("./cron/releaseEarnings");
//
// Install node-cron:
//   npm install node-cron
//

const cron           = require("node-cron");
const revenueService = require("../services/revenueService");

// Run every hour at minute 0  →  "0 * * * *"
// Run every day  at midnight  →  "0 0 * * *"
const SCHEDULE = process.env.EARNINGS_RELEASE_SCHEDULE || "0 * * * *";

cron.schedule(SCHEDULE, async () => {
  console.log(`[cron:releaseEarnings] Running at ${new Date().toISOString()}`);
  try {
    const result = await revenueService.releaseMaturedEarnings();
    console.log(`[cron:releaseEarnings] Done — released: ${result.released}`);
  } catch (err) {
    console.error("[cron:releaseEarnings] Error:", err.message);
  }
});

console.log(`[cron:releaseEarnings] Scheduled: "${SCHEDULE}"`);
