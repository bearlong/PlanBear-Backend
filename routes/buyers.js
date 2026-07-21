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
 * /sap-sourcer:
 *   get:
 *     summary: Get sap-sourcer info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve all sap-sourcer info and return as JSON
 *     responses:
 *       200:
 *         description: Success, all sap-sourcer info retrieved
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
 *                        example: "C01"
 *                      name:
 *                        type: string
 *                        example: "許傳民"
 *                      username:
 *                        type: string
 *                        example: "7125"
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
      code: "A01",
      name: "大強",
      username: "3376",
      factory: "TXG",
    },
    {
      code: "C01",
      name: "許傳民",
      username: "7125",
      factory: "TPE",
    },
    {
      code: "C02",
      name: "王小明",
      username: "7126",
      factory: "TAO",
    },
  ];
};

async function getData() {
  try {
    let sapSourcer = supabase
      .schema(process.env.DB_SCHEMA)
      .from("buyers")
      .select("username, name, factory")
      .order("username", { ascending: true });

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
  await logAction(`GET /sap-sourcer`, "info", req);

  try {
    if (isMock) {
      const mockData = getMockData();
      await logAction(`Using mock data for sap-sourcer`, "info", req);
      return res.status(200).json({
        status: "success",
        message: "Mock data returned.",
        data: mockData,
      });
    }
    const data = await getData();

    if (!data || data.length === 0) {
      await logAction(`No data found for sap-sourcer`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    await logAction(`Found ${data.length} sap-sourcer`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /sap-sourcer: ${error.message}`,
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
