import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../configs/supabase.js";
import { logAction, logUserAction } from "#utils/useLogger.js";

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get user info
 *     tags:
 *       - User
 *     description: Retrieve user info (decoded from JWT) and return as JSON
 *     responses:
 *       200:
 *         description: Success, user info retrieved from JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "已成功撈取user"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         username:
 *                           type: string
 *                           example: "8892"
 *                         name:
 *                           type: string
 *                           example: "Bear_Shen 沈正龍"
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

// 路徑GET /api/users：取得所有用戶列表。

async function getUsersSelectOptions(query, page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;

  const { count, error: countError } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("b_user")
    .select("*", { count: "exact", head: true }) // 只取 count
    .or(
      `username.ilike.%${query}%,` +
        `dept.ilike.%${query}%,` +
        `dept_name.ilike.%${query}%,` +
        `fullname.ilike.%${query}%,` +
        `ename.ilike.%${query}%`,
    );

  if (countError) throw new Error(countError.message);

  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("b_user")
    .select("username, dept, dept_name, fullname, ename")
    .or(
      `username.ilike.%${query}%,` +
        `dept.ilike.%${query}%,` +
        `dept_name.ilike.%${query}%,` +
        `fullname.ilike.%${query}%,` +
        `ename.ilike.%${query}%`,
    )
    .range(offset, offset + limit - 1);
  const totalPages = Math.ceil(count / limit);
  if (error) {
    throw new Error(error.message);
  }
  return { data, count, totalPages };
}

router.get("/select-options", async (req, res) => {
  const { query, page } = req.query;
  // logUserAction(`GET /users/select-options?query=${query}`, req);
  try {
    if (!query) {
      return res.status(200).json({
        status: "success",
        data: [],
        message: "not data found",
      });
    }

    const { data, count, totalPages } = await getUsersSelectOptions(
      query,
      page,
    );
    res.status(200).json({
      status: "success",
      data,
      count,
      totalPages,
      message: "已成功撈取user",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/getUserInfo", (req, res) => {
  try {
    res.status(200).json({
      status: "success",
      data: { user: req.user },
      message: "已成功撈取user",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

export default router;
