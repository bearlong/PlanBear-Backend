import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../configs/supabase.js";
import { logAction } from "../utils/useLogger.js";
const isMock = process.env.USE_MOCK === "true";

/**
 * @swagger
 * /factories:
 *   get:
 *     summary: Get factories info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve all factories info and return as JSON
 *     responses:
 *       200:
 *         description: Success, all factories info retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "已找到資料"
 *                 data:
 *                   type: array
 *                   items:
 *                    type: object
 *                    properties:
 *                      code:
 *                        type: string
 *                        example: "CS00"
 *                      name:
 *                        type: string
 *                        example: "馳諾瓦貿易服務（東莞）有限公司"
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

const getMockData = () => {
  return [
    {
      code: "PB00",
      name: "熊計畫股份有限公司",
    },
    {
      code: "VB00",
      name: "熊計畫(越南)股份有限公司",
    },
  ];
};

async function getData() {
  try {
    let sapSourcer = supabase
      .schema(process.env.DB_SCHEMA)
      .from("factory")
      .select("name, code");

    const { data, error } = await sapSourcer;
    if (error) throw error; // 抛出錯誤

    return data;
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

// 路徑GET /api/users：取得所有用戶列表。
router.get("/", async (req, res) => {
  await logAction(`GET /factories`, "info", req);
  try {
    if (isMock) {
      const mockData = getMockData();
      await logAction(
        `Using mock data for factories: ${JSON.stringify(mockData)}`,
        "info",
        req,
      );
      return res.status(200).json({
        status: "success",
        message: "已找到資料 (mock)",
        data: mockData,
      });
    }

    const data = await getData();

    if (!data || data.length === 0) {
      await logAction(`No data found for factories`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    await logAction(`Found ${data.length} factories`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /factories: ${error.message}`,
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
