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
 * /parts:
 *   get:
 *     summary: Get parts info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve all parts info by pagination and return as JSON
 *     parameters:
 *       - in: query
 *         name: search
 *         description: Search term to filter the parts by name or description.
 *         required: false
 *         schema:
 *           type: string
 *           example: "PSM08R-050RIM-WR1-R"
 *       - in: query
 *         name: page
 *         description: Page number for pagination.
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Success, all parts info by pagination retrieved
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
 *                      description:
 *                        type: string
 *                        example: "FRENCH MANUAL PSM08R-050RIM-WR1-R 80P"
 *                      name:
 *                        type: string
 *                        example: "84A00800048-RA1"
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
        name: "part0001-RA1",
        description: "User Guide - Industrial Controller",
      },
      {
        id: 2,
        created_at: "2025-02-05T08:53:57.080408+00:00",
        name: "part0002-RA1",
        description: "Installation Manual - Sensor Module",
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
          item.description.toLowerCase().includes(normalizedQuery),
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
      .from("parts")
      .select("*", { count: "exact" })
      .order("name", { ascending: true });

    // 篩選符合條件的資料
    // 如果 query 有值，加入 WHERE 條件

    if (query) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,description.ilike.%${query}%`,
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

// 料號權限控管
// async function getData(query, page = 1, user) {
//   const deptSet = new Set(user.dept || []);
//   const roleSet = new Set(user.role || []);

//   let company = 'UNKNOWN';

//   try {
//     const limit = 20;
//     const offset = (page - 1) * limit;
//     const params = {
//       p_dept_csv: user.dept[0], // 例如 '60229'
//       p_factory: company, // 例如 'planbear'
//       p_limit: limit,
//       p_offset: offset,
//     };
//     if (query && query.trim()) params.p_q = query.trim();

//     let queryBuilder = supabase
//       .schema(process.env.DB_SCHEMA)

//     const { data, error } = await queryBuilder;
//     const totalCount = data[0]?.total_count ?? 0;
//     const totalPages = Math.ceil(totalCount / limit);
//     if (error) throw error; // 抛出錯誤
//     return { data, count: totalCount, totalPages };
//   } catch (err) {
//     console.error('Error fetching data from Supabase:', err);
//     throw new Error(err.message);
//   }
// }

// 路徑GET /api/users：取得所有用戶列表。

router.get("/", async (req, res) => {
  const { search, page } = req.query;

  await logAction(
    `GET /parts${search ? `?search=${search}` : ""}`,
    "info",
    req,
  );

  try {
    if (isMock) {
      console.log(
        `Mock GET /parts called with search="${search}" and page=${page}`,
      );
      const { data, count, totalPages } = getMockData(search, page);
      await logAction(`Mock found ${data.length} parts`, "info", req);
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
      await logAction(`No parts found for query="${search}"`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    await logAction(`Found parts (total=${count})`, "info", req);

    res.status(200).json({
      status: "success",
      message: "Not found",
      data,
      count,
      totalPages,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /parts: ${error.message}`,
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
