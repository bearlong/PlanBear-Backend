import cron from "node-cron";
import { calibrationAutoNoticeBehindtime } from "../services/calibration/calibrationAutoNoticeBehindtime.service.js";

export function scheduleCalibrationAutoNoticeBehindtime() {
  cron.schedule(
    "0 30 10 * * *", // 每天 10:30 執行一次
    async () => {
      try {
        console.log("[CRON] CalibrationAutoNoticeBehindtime start");
        // await calibrationAutoNoticeBehindtime();
        console.log("每天 10:30 執行一次 calibrationAutoNoticeBehindtime");
        console.log("[CRON] CalibrationAutoNoticeBehindtime done");
      } catch (error) {
        console.error(error);
      }
    },
    {
      timezone: "Asia/Taipei",
    },
  );
}
