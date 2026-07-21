import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../configs/supabase.js";
import { logAction } from "../utils/useLogger.js";

const isMock = process.env.USE_MOCK === "true";
const requiredQueryParams = ["factoryCode", "brandCode", "vendorCode", "parts"];

/**
 * @swagger
 * /last-price:
 *   get:
 *     summary: Get last-price info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve the latest quotation based on factory, brand, vendor, buyer, and part details, and return the data in JSON format.
 *     parameters:
 *       - in: query
 *         name: factoryCode
 *         description: Factory code used to retrieve the latest quotation.
 *         required: true
 *         schema:
 *           type: string
 *           example: "VV00"
 *       - in: query
 *         name: brandCode
 *         description: Brand code used to retrieve the latest quotation.
 *         required: true
 *         schema:
 *           type: string
 *           example: "MT0915"
 *       - in: query
 *         name: vendorCode
 *         description: Vendor code used to retrieve the latest quotation.
 *         required: true
 *         schema:
 *           type: string
 *           example: "0004531U"
 *       - in: query
 *         name: buyerCode
 *         description: Buyer code used to retrieve the latest quotation.
 *         required: true
 *         schema:
 *           type: string
 *           example: "T28"
 *       - in: query
 *         name: parts
 *         description: Parts code used to retrieve the latest quotation.
 *         required: true
 *         schema:
 *           type: string
 *           example: "11AW1H100R1-H00"
 *     responses:
 *       200:
 *         description: Successfully retrieved the latest quotation
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
 *                      currency:
 *                        type: string
 *                        example: "USD"
 *                      lastprice:
 *                        type: number
 *                        example: 0.0085
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

const mockData = () => {
  return [
    {
      factory: "PB00",
      brand: "MT0011",
      vendor: "0003456A",
      buyer: "T28",
      partno: "part0001-RA1",
      currency: "USD",
      lastprice: 0.0085,
      pricedate: "2026-05-01",
    },
    {
      factory: "VB00",
      brand: "MT0033",
      vendor: "0003456U",
      buyer: "T28",
      partno: "part0002-RA1",
      currency: "USD",
      lastprice: 1.25,
      pricedate: "2026-04-18",
    },
  ];
};

function isSameCode(value, target) {
  return (
    String(value ?? "")
      .trim()
      .toUpperCase() ===
    String(target ?? "")
      .trim()
      .toUpperCase()
  );
}

function getMissingParams(query) {
  return requiredQueryParams.filter(
    (param) => !String(query[param] ?? "").trim(),
  );
}

function getMockData({ factoryCode, brandCode, vendorCode, parts }) {
  const result = mockData()
    .filter(
      (item) =>
        isSameCode(item.factory, factoryCode) &&
        isSameCode(item.brand, brandCode) &&
        isSameCode(item.vendor, vendorCode) &&
        isSameCode(item.partno, parts),
    )
    .sort((a, b) => new Date(b.pricedate) - new Date(a.pricedate))[0];

  if (!result) return null;

  return {
    currency: result.currency,
    lastprice: result.lastprice,
  };
}

async function getData(factoryCode, brandCode, vendorCode, parts) {
  try {
    let lastPrice = supabase
      .schema(process.env.DB_SCHEMA)
      .from("phistory")
      .select("currency, lastprice")
      .eq("factory", factoryCode)
      .eq("brand", brandCode)
      .eq("vendor", vendorCode)
      .eq("partno", parts)
      .order("pricedate", { ascending: false }) // 按照 pricedate 降序排列
      .limit(1)
      .maybeSingle();
    const { data, error } = await lastPrice;
    console.log(data);

    if (error) throw error; // 抛出錯誤

    return data;
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

// 路徑GET /api/users：取得所有用戶列表。
router.get("/", async (req, res) => {
  const { factoryCode, brandCode, vendorCode, parts } = req.query;
  console.log(factoryCode, brandCode, vendorCode, parts);
  await logAction(
    `GET /last-price?factoryCode=${factoryCode}&brandCode=${brandCode}&vendorCode=${vendorCode}&parts=${parts}`,
    "info",
    req,
  );

  try {
    const missingParams = getMissingParams(req.query);
    if (missingParams.length > 0) {
      await logAction(
        `Missing required params for last-price: ${missingParams.join(", ")}`,
        "warn",
        req,
      );
      return res.status(400).json({
        status: "error",
        message: `Missing required query params: ${missingParams.join(", ")}`,
        data: [],
      });
    }

    if (isMock) {
      console.log(
        `Mock GET /last-price called with factoryCode="${factoryCode}", brandCode="${brandCode}", vendorCode="${vendorCode}", parts="${parts}"`,
      );
      const data = getMockData({
        factoryCode,
        brandCode,
        vendorCode,
        parts,
      });

      if (!data) {
        await logAction("Mock no data found for last-price", "warn", req);
        return res.status(200).json({
          status: "success",
          message: "No data found.",
          data: [],
        });
      }

      await logAction("Mock found last-price", "info", req);
      return res.status(200).json({
        status: "success",
        message: "Data fetched successfully (mock)",
        data,
      });
    }

    const data = await getData(factoryCode, brandCode, vendorCode, parts);
    if (!data) {
      await logAction(`No data found for last-price`, "warn", req);
      return res.status(200).json({
        status: "success",
        message: "No data found.",
        data: [],
      });
    }

    await logAction(`Found last-price`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /last-price: ${error.message}`,
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
