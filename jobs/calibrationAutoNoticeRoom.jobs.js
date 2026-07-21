import cron from "node-cron";
import { calibrationAutoNoticeRoom } from "../services/calibration/calibrationAutoNoticeRoom.service.js";

export function scheduleCalibrationAutoNoticeRoom() {
  cron.schedule(
    "0 0 2 15 * *", // 每月 15 日凌晨 2:00 執行一次
    async () => {
      try {
        console.log("[CRON] CalibrationAutoNoticeRoom start");
        // await calibrationAutoNoticeRoom();
        console.log("每月 15 日凌晨 2:00 執行一次 calibrationAutoNoticeRoom");
        console.log("[CRON] CalibrationAutoNoticeRoom done");
      } catch (error) {
        console.error(error);
      }
    },
    {
      timezone: "Asia/Taipei",
    },
  );
}
