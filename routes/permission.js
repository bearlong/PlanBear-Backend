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

async function getDept(dept) {
  try {
    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("b_dept")
      .select("dept, dept_name")
      .eq("dept", dept)
      .order("dept", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return data[0] || null; // 返回第一個部門或 null
  } catch (err) {
    console.error("Error fetching department:", err);
    throw new Error("Failed to fetch department");
  }
}

async function getUser(username) {
  try {
    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("b_user")
      .select("username, fullname, ename")
      .eq("username", username)
      .order("username", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return data[0] || null; // 返回第一個用戶或 null
  } catch (err) {
    console.error("Error fetching department:", err);
    throw new Error("Failed to fetch department");
  }
}

async function getModuleList() {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("modules")
    .select("code, name")
    .order("code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function getRoleList() {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("roles")
    .select("role_code, name, description")
    .order("role_code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function getRoleDetail(role_code) {
  try {
    const { data: deptData, error: deptError } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("dept_for_role")
      .select("dept, granted_by")
      .eq("role_code", role_code)
      .order("dept", { ascending: true });

    if (deptError) {
      throw new Error(deptError.message);
    }
    const updatedDeptData = await Promise.all(
      deptData.map(async (row, index) => {
        const dept = await getDept(row.dept);
        return {
          ...row,
          dept_name: dept ? dept.dept_name : null,
          type: "dept",
        };
      }),
    );

    const { data: userData, error: userError } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("user_for_role")
      .select("username, granted_by")
      .eq("role_code", role_code)
      .order("username", { ascending: true });
    if (userError) {
      throw new Error(userError.message);
    }
    const updatedUserData = await Promise.all(
      userData.map(async (row) => {
        const user = await getUser(row.username);
        return {
          ...row,
          name: user
            ? user.ename
              ? `${user.ename} ${user.fullname}`
              : user.fullname
            : null,
          type: "user",
        };
      }),
    );

    const crossData = updatedDeptData.concat(updatedUserData);
    crossData.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dept" ? -1 : 1;
      const keyA = a.dept ?? a.username ?? "";
      const keyB = b.dept ?? b.username ?? "";
      return keyA.localeCompare(keyB);
    });
    console.log(deptData);

    return crossData;
  } catch (err) {
    console.error("Error fetching role details:", err);
    throw new Error("Failed to fetch role details");
  }
}

router.get("/modules", async (req, res) => {
  // logUserAction(`GET /modules`, req);
  try {
    const data = await getModuleList();
    if (!data || data.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
        message: "not data found",
      });
    }

    res.status(200).json({
      status: "success",
      data,
      message: "已成功撈取modules",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/roles", async (req, res) => {
  // logUserAction(`GET /modules`, req);
  try {
    const data = await getRoleList();
    if (!data || data.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
        message: "not data found",
      });
    }

    res.status(200).json({
      status: "success",
      data,
      message: "已成功撈取modules",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/roles/:id", async (req, res) => {
  const { id } = req.params;

  await logAction(`Admin GET /roles/${id}`, "info", req);
  // await logUserAction({
  //   user: req.user,
  //   action: 'create',
  //   module: 'Procurement',
  //   detail: JSON.stringify({
  //     status: 'error',
  //     reason: '寫入失敗，activeid 為空',
  //   }),
  //   req,
  // });
  try {
    const data = await getRoleDetail(id);
    if (!data || data.length === 0) {
      return res.status(200).json({
        status: "success",
        data: [],
        message: "not data found",
      });
    }

    res.status(200).json({
      status: "success",
      data,
      message: "已成功撈取roles",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

export default router;
