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
 * /vendors:
 *   get:
 *     summary: Get vendors info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve all vendors info by pagination and return as JSON
 *     parameters:
 *       - in: query
 *         name: search
 *         description: Search term to filter the vendors by name or code.
 *         required: false
 *         schema:
 *           type: string
 *           example: "0001043"
 *       - in: query
 *         name: page
 *         description: Page number for pagination.
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Success, all vendors info by pagination retrieved
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
 *                      id:
 *                        type: integer
 *                        example: 1
 *                      created_at:
 *                        type: date-time
 *                        example: "2025-02-04T08:53:57.080408+00:00"
 *                      code:
 *                        type: string
 *                        example: "0001654U"
 *                      name:
 *                        type: string
 *                        example: "國巨電子(東莞)有限公司"
 *                      currency:
 *                        type: string
 *                        example: "USD"
 *                 count:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 5
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

const mockData = () => {
  return {
    data: [
      {
        id: 1,
        created_at: "2025-02-04T08:53:57.080408+00:00",
        code: "0003456A",
        name: "A型電子股份有限公司",
        currency: "USD",
      },
      {
        id: 2,
        created_at: "2025-02-05T08:53:57.080408+00:00",
        code: "0003456U",
        name: "A型電子股份有限公司(美國)",
        currency: "USD",
      },
      {
        id: 3,
        created_at: "2025-07-05T08:53:57.080408+00:00",
        code: "0004888U",
        name: "山形科技股份有限公司",
        currency: "TWD",
      },
    ],
    count: 3,
    totalPages: 1,
  };
};

function getMockData(query, page = 1) {
  const limit = 20;
  const currentPage = Number(page) > 0 ? Number(page) : 1;
  const offset = (currentPage - 1) * limit;
  const { data } = mockData();
  const normalizedQuery = query?.trim().toLowerCase();
  const filteredData = normalizedQuery
    ? data.filter(
        (item) =>
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.code.toLowerCase().includes(normalizedQuery),
      )
    : data;
  return {
    data: filteredData.slice(offset, offset + limit),
    count: filteredData.length,
    totalPages: Math.ceil(filteredData.length / limit),
  };
}

async function getData(query, page = 1) {
  try {
    const limit = 20;
    const offset = (page - 1) * limit;

    let queryBuilder = supabase
      .schema(process.env.DB_SCHEMA)
      .from("vendor")
      .select("*", { count: "exact" });
    // 如果 query 有值，加入 WHERE 條件
    if (query) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,code.ilike.%${query}%`,
      ); // 模糊匹配 code
    }

    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;
    const totalPages = Math.ceil(count / limit);
    if (error) throw error; // 如果有錯誤，拋出錯誤
    return { data, count, totalPages };
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

// 路徑GET /api/users：取得所有用戶列表。
router.get("/", async (req, res) => {
  const { search, page } = req.query;

  await logAction(`GET /vendors?search=${search}&page=${page}`, "info", req);
  try {
    if (isMock) {
      console.log(
        `✅ Mock GET /vendors called with search="${search}" and page=${page}`,
      );
      const { data, count, totalPages } = getMockData(search, page);
      await logAction(`Mock found ${data.length} vendors`, "info", req);
      return res.status(200).json({
        status: "success",
        message: "已找到資料 (mock)",
        data,
        count,
        totalPages,
      });
    }

    const { data, count, totalPages } = await getData(search, page);
    if (!data || data.length === 0) {
      await logAction(`No vendors found for query="${search}"`, "warn", req);
      return res.status(200).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    await logAction(`Found vendors (total=${count})`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data,
      count,
      totalPages,
    });
  } catch (error) {
    await logAction(`Error fetching vendors: ${error.message}`, "error", req);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

export default router;
