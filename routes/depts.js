import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../configs/supabase.js";
import { logAction, logUserAction } from "#utils/useLogger.js";
import {
  getOrgTree,
  getDeptUsersByDept,
  searchUser,
} from "../services/orgTree.service.js";

const isMock = process.env.USE_MOCK === "true";

const mockDeptRows = [
  {
    dept: "ROOT",
    dept_name: "PB Group",
    up_dept: "0",
    level: 1,
  },
  {
    dept: "E000E",
    dept_name: "Engineering",
    up_dept: "ROOT",
    level: 2,
  },
  {
    dept: "3007",
    dept_name: "Quality Assurance",
    up_dept: "ROOT",
    level: 2,
  },
  {
    dept: "60229",
    dept_name: "Software Development",
    up_dept: "E000E",
    level: 3,
  },
  {
    dept: "60230",
    dept_name: "System Validation",
    up_dept: "E000E",
    level: 3,
  },
  {
    dept: "QA01",
    dept_name: "Calibration QA",
    up_dept: "3007",
    level: 3,
  },
];

const mockUsers = [
  {
    username: "8892",
    fullname: "沈正龍",
    ename: "Bear_Shen",
    job_title: "Engineer",
    dept: "60229",
  },
  {
    username: "7125",
    fullname: "許傳民",
    ename: "Min_Hsu",
    job_title: "Manager",
    dept: "60230",
  },
  {
    username: "7126",
    fullname: "王小明",
    ename: "Ming_Wang",
    job_title: "QA Specialist",
    dept: "QA01",
  },
  {
    username: "admin",
    fullname: "管理員",
    ename: "Admin",
    job_title: "System Admin",
    dept: "ROOT",
  },
];

const normalize = (value) => value?.toString().trim().toLowerCase() ?? "";

const toUserNode = (user, deptName = "") => ({
  id: `user:${user.username}`,
  type: "user",
  username: user.username,
  fullname: user.fullname,
  ename: user.ename,
  dept: deptName,
  job_title: user.job_title,
  label: `${user.ename ? `${user.ename} ` : ""}${user.fullname} (${
    user.username
  }, ${user.job_title})`,
  children: [],
});

function getMockOrgTree() {
  const deptMap = new Map();
  mockDeptRows.forEach((dept) => {
    deptMap.set(dept.dept, {
      id: `dept:${dept.dept}`,
      type: "dept",
      dept: dept.dept,
      name: dept.dept_name,
      level: dept.level,
      children: [],
    });
  });

  const roots = [];
  mockDeptRows.forEach((dept) => {
    const node = deptMap.get(dept.dept);
    if (!node) return;

    if (dept.up_dept === "0" || !dept.up_dept) {
      roots.push(node);
      return;
    }

    const parent = deptMap.get(dept.up_dept);
    if (parent) parent.children.push(node);
  });

  const sortNode = (node) => {
    node.children.sort((a, b) =>
      (a.name || a.label || "").localeCompare(
        b.name || b.label || "",
        "zh-Hant",
      ),
    );
    node.children.filter((child) => child.type === "dept").forEach(sortNode);
  };

  roots.forEach(sortNode);
  return roots;
}

function getMockDeptUsersByDept(dept, { limit = 200, offset = 0 } = {}) {
  const deptNameMap = new Map(
    mockDeptRows.map((item) => [item.dept, item.dept_name]),
  );
  return mockUsers
    .filter((user) => user.dept === dept)
    .slice(Number(offset), Number(offset) + Number(limit))
    .map((user) => toUserNode(user, deptNameMap.get(user.dept) || ""));
}

function searchMockUser(query) {
  const deptNameMap = new Map(
    mockDeptRows.map((item) => [item.dept, item.dept_name]),
  );
  const normalizedQuery = normalize(query);
  return mockUsers
    .filter((user) =>
      [
        user.username,
        user.fullname,
        user.ename,
        user.job_title,
        user.dept,
        deptNameMap.get(user.dept),
      ].some((value) => normalize(value).includes(normalizedQuery)),
    )
    .map((user) => toUserNode(user, deptNameMap.get(user.dept) || ""));
}

function getMockDeptsSelectOptions(query, page = 1) {
  const limit = 20;
  const currentPage = Number(page) > 0 ? Number(page) : 1;
  const offset = (currentPage - 1) * limit;
  const normalizedQuery = normalize(query);
  const filteredData = mockDeptRows
    .filter((dept) =>
      [dept.dept, dept.dept_name].some((value) =>
        normalize(value).includes(normalizedQuery),
      ),
    )
    .map(({ dept, dept_name }) => ({ dept, dept_name }));

  return {
    data: filteredData.slice(offset, offset + limit),
    count: filteredData.length,
    totalPages: Math.ceil(filteredData.length / limit),
  };
}

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

async function getDeptTree() {
  const { data, error } = await supabase;

  if (error) {
    console.error("Fetch dept_tree error:", error);
    throw new Error(error.message);
  }

  return data;
}

async function getDeptsSelectOptions(query, page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;
  const countResult = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("b_dept")
    .select("dept, dept_name", { count: "exact", head: true })
    .or(`dept_name.ilike.%${query}%,` + `dept.ilike.%${query}%`);

  if (!countResult)
    throw new Error("Supabase count query failed: result is undefined");

  const { count, error: countError } = countResult;

  if (countError) throw new Error(countError.message);

  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("b_dept")
    .select("dept, dept_name")
    .or(`dept_name.ilike.%${query}%,` + `dept.ilike.%${query}%`)
    .range(offset, offset + limit - 1);
  const totalPages = Math.ceil(count / limit);
  if (error) {
    throw new Error(error.message);
  }
  return { data, count, totalPages };
}

router.get("/dept-tree", async (req, res) => {
  // logUserAction(`GET /users/select-options?query=${query}`, req);
  try {
    const data = isMock ? getMockOrgTree() : await getOrgTree();
    res.status(200).json({
      status: "success",
      data,
      message: "已成功撈取dept",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/dept-users", async (req, res) => {
  try {
    const dept = (req.query.dept || "").trim();
    const limit = Number(req.query.limit) || 200;
    const offset = Number(req.query.offset) || 0;

    if (!dept) {
      return res.status(400).json({
        status: "error",
        message: "dept is required",
      });
    }

    const data = isMock
      ? getMockDeptUsersByDept(dept, { limit, offset })
      : await getDeptUsersByDept(dept, { limit, offset });
    res.status(200).json({
      status: "success",
      data,
      message: "已成功撈取dept users",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/search-user", async (req, res) => {
  try {
    const query = (req.query.query || "").trim();

    if (!query) {
      return res.status(400).json({
        status: "error",
        message: "query is required",
      });
    }

    const data = isMock ? searchMockUser(query) : await searchUser(query);
    res.status(200).json({
      status: "success",
      data,
      message: "已成功撈取dept users",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

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

    const { data, count, totalPages } = isMock
      ? getMockDeptsSelectOptions(query, page)
      : await getDeptsSelectOptions(query, page);
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

export default router;
