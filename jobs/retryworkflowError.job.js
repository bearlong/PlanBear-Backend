import cron from "node-cron";
import mssql from "../configs/mssql.js";
import supabase from "../configs/supabase.js";
import "dotenv/config.js";

function parseApplyInfo(url) {
  const match = url.match(/\/compare-apply\/(\d{10})_V(\d+)\//);

  if (!match) return null;

  return {
    apply_no: match[1],
    version: Number(match[2]),
    both: match[1] + "_V" + match[2],
  };
}

function getCloseDate(comments) {
  if (!Array.isArray(comments) || comments.length === 0) return null;

  const lastTimestamp = comments[comments.length - 1].timestamp;
  if (!lastTimestamp) return null;

  // '2025/08/28 16:25:15' → '2025-08-28'
  return lastTimestamp.split(" ")[0].replace(/\//g, "-");
}

let isRunning = false;

function retryWorkflowSync(job) {
  console.log("Running retry workflow error job...");
}

function markRetryJobCompleted(job) {
  console.log("Retry workflow error job completed.");
}

export function startRetryErrorFlowJob() {
  cron.schedule("*/15 * * * *", async () => {
    if (isRunning) return; // ✅ 避免重疊
    isRunning = true;

    console.log("Running retry workflow error job...");

    try {
      await retryWorkflowSync();
      markRetryJobCompleted();
    } catch (err) {
      console.error("retry job error:", err);
    } finally {
      isRunning = false;
    }
  });
}
