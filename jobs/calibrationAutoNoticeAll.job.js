import cron from "node-cron";
import { calibrationAutoNoticeAll } from "../services/calibration/calibrationAutoNoticeAll.service.js";

export function scheduleCalibrationAutoNoticeAll() {
  cron.schedule(
    "5 0 * * *", // 每天 00:05 執行一次
    async () => {
      try {
        console.log("[CRON] CalibrationAutoNoticeAll start");
        // await calibrationAutoNoticeAll();
        console.log("每天 00:05 執行一次 calibrationAutoNoticeAll");
        console.log("[CRON] CalibrationAutoNoticeAll done");
      } catch (error) {
        console.error(error);
      }
    },
    {
      timezone: "Asia/Taipei",
    },
  );
}
