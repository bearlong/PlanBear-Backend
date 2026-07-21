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
 * /origin-countries:
 *   get:
 *     summary: Get origin-countries info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve all origin-countries info and return as JSON
 *     responses:
 *       200:
 *         description: Success, all origin-countries info retrieved
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
 *                        example: "SL"
 *                      name:
 *                        type: string
 *                        example: "獅子山共和國"
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
      code: "SL",
      name: "Sierra Leone",
    },
    {
      code: "TW",
      name: "Taiwan",
    },
    {
      code: "US",
      name: "United States",
    },
    { code: "AD", name: "安道爾" },
    { code: "AE", name: "阿拉伯聯合大公國" },
    { code: "AF", name: "阿富汗" },
    { code: "AG", name: "安提瓜和巴爾布達" },
    { code: "AI", name: "安圭拉島" },
    { code: "AL", name: "阿爾巴尼亞" },
    { code: "AM", name: "亞美尼亞" },
    { code: "AN", name: "荷屬安地列斯群島" },
    { code: "AO", name: "安哥拉" },
    { code: "AQ", name: "南極洲" },
    { code: "AR", name: "阿根廷" },
    { code: "AS", name: "美屬薩摩亞" },
    { code: "AT", name: "奧地利" },
    { code: "AU", name: "澳大利亞" },
    { code: "AW", name: "阿盧巴島" },
    { code: "AZ", name: "亞塞拜然" },
    { code: "BA", name: "波士尼亞和塞哥維亞" },
    { code: "BB", name: "巴貝多" },
    { code: "BD", name: "孟加拉" },
    { code: "BE", name: "比利時" },
    { code: "BF", name: "布吉納法索" },
    { code: "BG", name: "保加利亞" },
    { code: "BH", name: "巴林" },
    { code: "BI", name: "蒲隆地" },
    { code: "BJ", name: "貝南" },
    { code: "BL", name: "藍色" },
    { code: "BM", name: "百慕達群島" },
    { code: "BN", name: "汶萊" },
    { code: "BO", name: "玻利維亞" },
    { code: "BR", name: "巴西" },
    { code: "BS", name: "巴哈馬" },
    { code: "BT", name: "不丹" },
    { code: "BV", name: "波霧群島" },
    { code: "BW", name: "波扎那共和國" },
    { code: "BY", name: "白俄羅斯" },
    { code: "BZ", name: "貝里斯" },
    { code: "CA", name: "加拿大" },
    { code: "CC", name: "可可斯群島" },
    { code: "CD", name: "剛果民主共和國" },
    { code: "CF", name: "中非共和國" },
    { code: "CG", name: "剛果共和國" },
    { code: "CH", name: "瑞士" },
    { code: "CI", name: "象牙海岸" },
    { code: "CK", name: "科克群島" },
    { code: "CL", name: "智利" },
    { code: "CM", name: "喀麥隆" },
    { code: "CN", name: "中國" },
    { code: "CO", name: "哥倫比亞" },
    { code: "CR", name: "哥斯大黎加" },
    { code: "CS", name: "塞爾維亞和蒙特尼哥羅" },
    { code: "CU", name: "古巴" },
    { code: "CV", name: "維德角共和國" },
    { code: "CX", name: "耶誕島" },
    { code: "CY", name: "塞普勒斯" },
    { code: "CZ", name: "捷克共和國" },
    { code: "DE", name: "德國" },
    { code: "DJ", name: "吉布地共和國" },
    { code: "DK", name: "丹麥" },
    { code: "DM", name: "多米尼克" },
    { code: "DO", name: "多明尼加共和國" },
    { code: "DZ", name: "阿爾及利亞" },
    { code: "EC", name: "厄瓜多共和國" },
    { code: "EE", name: "愛沙尼亞" },
    { code: "EG", name: "埃及" },
    { code: "EH", name: "西薩哈拉" },
    { code: "ER", name: "埃立特里亞" },
    { code: "ES", name: "西班牙" },
    { code: "ET", name: "衣索比亞" },
    { code: "EU", name: "歐盟" },
    { code: "FI", name: "芬蘭" },
    { code: "FJ", name: "斐濟" },
    { code: "FK", name: "福克蘭群島" },
    { code: "FM", name: "密克羅尼西亞" },
    { code: "FO", name: "法羅群島" },
    { code: "FR", name: "法國" },
    { code: "GA", name: "加彭" },
    { code: "GB", name: "英國" },
    { code: "GD", name: "格瑞那達" },
    { code: "GE", name: "喬治亞" },
    { code: "GF", name: "法屬蓋亞那" },
    { code: "GH", name: "迦納" },
    { code: "GI", name: "直布羅陀" },
    { code: "GL", name: "格陵蘭島" },
    { code: "GM", name: "甘比亞" },
    { code: "GN", name: "幾內亞" },
    { code: "GP", name: "哥德洛普島" },
    { code: "GQ", name: "赤道幾內亞" },
    { code: "GR", name: "希臘" },
  ];
};

async function getData() {
  try {
    let sapSourcer = supabase
      .schema(process.env.DB_SCHEMA)
      .from("origin_country")
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
  await logAction(`GET /origin-countries`, "info", req);

  try {
    if (isMock) {
      const mockData = getMockData();
      await logAction(
        `Using mock data for origin-countries: ${JSON.stringify(mockData)}`,
        "info",
        req,
      );
      return res.status(200).json({
        status: "success",
        message: "Data fetched successfully (mock)",
        data: mockData,
      });
    }

    const data = await getData();

    if (!data || data.length === 0) {
      await logAction(`No data found for origin-countries`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    await logAction(`Found ${data.length} origin-countries`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /origin-countries: ${error.message}`,
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
