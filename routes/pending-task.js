import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../configs/supabase.js";
import { logAction } from "../utils/useLogger.js";
import { getPendingTasks } from "../utils/usePendingTask.js";
const isMock = process.env.USE_MOCK === "true";

/**
 * @swagger
 * /pending-task:
 *   get:
 *     summary: Get pending tasks
 *     tags:
 *       - Pending Task
 *     description: Retrieve pending tasks data and return as JSON
 *     responses:
 *       200:
 *         description: Success, pending tasks retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Fetched pending tasks."
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: No data found (when `data` is empty)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No data found."
 *                 data:
 *                   type: array
 *                   example: []
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "error.message"
 */

const getMockPendingTasks = (username) => [
  {
    id: 1,
    ref_id: "詢比價申請單",
    title: "demo",
    username: username,
    user_displayname: "Bear",
    memo: "This is a memo for 詢比價申請單",
    create_date: "2024-01-01",
    url: "/Procurement/Application/2025020002",
    model: "Procurement",
  },
  {
    id: 2,
    ref_id: "校驗簽名列表",
    title: "demo",
    username: username,
    user_displayname: "Bear",
    memo: "This is a memo for 校驗簽名列表",
    create_date: "2024-01-01",
    url: "/Calibration/signature-list",
    model: "Calibration",
  },
];

router.get("/", async (req, res) => {
  await logAction(`GET /pending-task`, "info", req);
  try {
    const { username } = req.query;
    if (isMock) {
      console.log("✅ Mock GET /pending-task called with username:", username);
      const mockData = getMockPendingTasks(username);
      await logAction(
        `Mock found ${mockData.length} pending tasks`,
        "info",
        req,
      );
      return res.status(200).json({
        status: "success",
        message: "已找到資料 (mock)",
        data: mockData,
      });
    }
    const data = await getPendingTasks(username);
    if (!data) {
      await logAction(`No pending tasks found`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "資料讀取失敗",
        data: [],
      });
    }

    await logAction(`Found ${data.length} pending tasks`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /pending-task: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

export default router;
