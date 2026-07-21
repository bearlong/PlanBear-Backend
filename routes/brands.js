import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../configs/supabase.js";
import { logAction } from "#utils/useLogger.js";

const isMock = process.env.USE_MOCK === "true";

/**
 * @swagger
 * /brands:
 *   get:
 *     summary: Get brands info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve all brands info by pagination and return as JSON
 *     parameters:
 *       - in: query
 *         name: search
 *         description: Search term to filter the brands by name or code.
 *         required: false
 *         schema:
 *           type: string
 *           example: "ARROW"
 *       - in: query
 *         name: page
 *         description: Page number for pagination.
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Success, all brands info by pagination retrieved
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
 *                        example: "MT0044"
 *                      name:
 *                        type: string
 *                        example: "ARROW PEMCO GROUP"
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
        code: "MT0011",
        name: "mango electronics",
      },
      {
        id: 2,
        created_at: "2025-02-05T08:53:57.080408+00:00",
        code: "MT0033",
        name: "thrifty electronics",
      },
    ],
  };
};

function getMockData(query, page = 1) {
  const limit = 20;
  const currentPage = Number(page) || 1;
  const offset = (currentPage - 1) * limit;
  const { data } = mockData();
  const normalizedQuery = query?.toLowerCase();
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
      .from("brand")
      .select("*", { count: "exact" });

    // 篩選符合條件的資料
    // 如果 query 有值，加入 WHERE 條件

    if (query) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,code.ilike.%${query}%`,
      ); // 模糊匹配 code
    }

    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data, error, count } = await queryBuilder;
    const totalPages = Math.ceil(count / limit);
    if (error) throw error; // 抛出錯誤
    return { data, count, totalPages };
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

// 路徑GET /api/users：取得所有用戶列表。
router.get("/", async (req, res) => {
  const { search, page } = req.query;

  await logAction(`GET /brands?search=${search}&page=${page}`, "info", req);
  try {
    if (isMock) {
      console.log(
        `Mock GET /brands called with search="${search}" and page=${page}`,
      );
      const { data, count, totalPages } = getMockData(search, page);
      await logAction(`Mock found ${data.length} brands`, "info", req);
      return res.status(200).json({
        status: "success",
        message: "Data fetched successfully (mock)",
        data,
        count,
        totalPages,
      });
    }

    const { data, count, totalPages } = await getData(search, page);

    if (!data || data.length === 0) {
      await logAction(`No brands found for query="${search}"`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }
    await logAction(
      `Found ${data.length} brands (total=${count})`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data,
      count,
      totalPages,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /brands: ${error.message}`,
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
