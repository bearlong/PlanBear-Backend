import cron from "node-cron";
import { SAPDownCalibration } from "../services/calibration/SAPDownCalibration.service.js";

export function scheduleSAPDownCalibration() {
  cron.schedule(
    "0 21 * * *", // 每天 21:00 執行一次
    async () => {
      try {
        console.log("[CRON] SAPDownCalibration start");
        // await SAPDownCalibration();
        console.log("每天 21:00 執行一次 SAPDownCalibration");
        console.log("[CRON] SAPDownCalibration done");
      } catch (error) {
        console.error(error);
      }
    },
    {
      timezone: "Asia/Taipei",
    },
  );
}
