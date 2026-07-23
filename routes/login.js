import express from "express";
const router = express.Router();
import multer from "multer";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import "dotenv/config.js";
import supabase from "../configs/supabase.js";
import mssql from "../configs/mssql.js";
import ActiveDirectory from "activedirectory2";
import sql from "mssql";
import https from "https";
import { logUserAction, logAction } from "../utils/useLogger.js";
import { resolveFactoryContextOnLogin } from "../services/userFactoryService.js";
import {
  getMockDemoRoles,
  getMockDemoRolesPermissions,
} from "../configs/mockDemoRoles.js";
const isMock = process.env.USE_MOCK === "true";
const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 10 * 60 * 60 * 1000,
  path: "/",
};
/**
 * @swagger
 * /login:
 *   post:
 *     summary: User login and authentication
 *     tags:
 *       - User
 *     description: Authenticates a user using a username and password, and returns a JWT token that can be stored in cookies for further API requests.
 *     requestBody:
 *       description: User credentials (username and password) for login.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "user123"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: Successful login, save a JWT token in cookies.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "一階段驗證成功"
 *       400:
 *         description: username or password error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sorry, Username Or Password Error！ / Invalid username format"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "伺服器錯誤"
 * /login/MFA:
 *   post:
 *     summary: Multi-factor authentication (MFA) for enhanced security
 *     tags:
 *       - User
 *     description: Verifies the user's identity by requiring a second authentication factor (such as IDExpert) in addition to the username and password.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         description: The token from the first login request (Bearer token or similar)
 *         required: true
 *         schema:
 *           type: string
 *           example: "Bearer <token>"
 *       - in: cookie
 *         name: MFAToken
 *         description: Multi-factor authentication token for verifying second factor
 *         required: true
 *         schema:
 *           type: string
 *           example: "<token>"
 *     responses:
 *       201:
 *         description: Successful MFA verification, returns user data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "二階段驗證成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     username:
 *                       type: string
 *                       example: "8892"
 *                     name:
 *                       type: string
 *                       example: "Bear_Shen 沈正龍"
 *       403:
 *         description: Token error or Certification error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Token is missing / Token is invalid or expired / 認證失敗 / 認證時間已逾時"
 *       401:
 *         description: username or password error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sorry, Username Or Password Error！"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "伺服器錯誤"
 */

const config = {
  url: process.env.AD_URL,
  baseDN: process.env.AD_BASE_DN,
};
const ad = new ActiveDirectory(config);
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const authenticateAD = (username, password) => {
  return new Promise((resolve, reject) => {
    ad.authenticate(username, password, (err, auth) => {
      if (err) {
        reject(errorMessages.invalidCredentials);
      }
      if (auth) {
        resolve(true);
      } else {
        reject(errorMessages.invalidCredentials);
      }
    });
  });
};

// 建立連線
const getUserData = async (username) => {
  try {
    let user = supabase
      .schema(process.env.DB_SCHEMA)
      .from("b_user")
      .select("*")
      .eq("username", username);
    const { data, error } = await user;
    if (data.length > 0) {
      return data[0]; // 返回第一筆資料，通常是唯一的
    } else {
      return null; // 沒有找到該用戶
    }
  } catch (err) {
    console.error("Error executing query:", err.message);
    throw new Error("Failed to fetch data");
  }
};

const getDept = async (dept) => {
  try {
    const { data, error } = await supabase;
    console.log(data);
    if (data.length > 0) {
      return data; // 返回第一筆資料，通常是唯一的
    } else {
      return null; // 沒有找到該用戶
    }
  } catch (err) {
    console.error("Error executing query:", err.message);
    throw new Error("Failed to fetch data");
  }
};

const getRole = async (username, dept) => {
  try {
    const { data: userRoleData, error: userError } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("user_for_role")
      .select("role_code")
      .eq("username", username);

    if (userError) throw userError;

    const { data: deptRoleData, error: deptError } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("dept_for_role")
      .select("role_code")
      .in("dept", dept);

    if (deptError) throw deptError;

    const combinedRoles = [
      ...(userRoleData?.map((item) => item.role_code) || []),
      ...(deptRoleData?.map((item) => item.role_code) || []),
    ];

    const uniqueRoles = [...new Set(combinedRoles)];

    return uniqueRoles.length > 0 ? uniqueRoles : [];
  } catch (err) {
    console.error("Error executing query:", err.message);
    throw new Error("Failed to fetch data");
  }
};

const getUserPermissions = async (username, deptArray, roleArray) => {
  try {
    const modules = await getMoudlePermissions(username, deptArray, roleArray);
    const forms = await getFormActionPermissions(
      username,
      deptArray,
      roleArray,
    );
    const attachments = await getAttachmentPermissions(
      username,
      deptArray,
      roleArray,
    );
    console.log(modules, forms, attachments);

    return {
      modules,
      forms: forms ?? [],
      attachments: attachments ?? [],
    };
  } catch (err) {
    console.error("Error fetching permissions:", err.message);
    throw new Error("Failed to fetch permissions");
  }
};

const safeData = (res) => (Array.isArray(res?.data) ? res.data : []);

const getMoudlePermissions = async (username, deptArray, roleArray) => {
  try {
    const byUser = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("module_permission")
      .select("*")
      .eq("type", "user")
      .eq("target_code", username);
    const byDept = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("module_permission")
      .select("*")
      .eq("type", "dept")
      .in("target_code", deptArray);
    const byRole = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("module_permission")
      .select("*")
      .eq("type", "role")
      .in("target_code", roleArray);
    const data = [
      ...safeData(byUser),
      ...safeData(byDept),
      ...safeData(byRole),
    ];
    const uniqueModules = [...new Set(data.map((item) => item.module_code))];
    return uniqueModules;
  } catch (err) {
    console.error("Error fetching permissions:", err.message);
    throw new Error("Failed to fetch permissions");
  }
};

const getFormActionPermissions = async (username, deptArray, roleArray) => {
  try {
    const byUser = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("form_action_permission")
      .select("form_code, action_code")
      .eq("type", "user")
      .eq("target_code", username);
    const byDept = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("form_action_permission")
      .select("form_code, action_code")
      .eq("type", "dept")
      .in("target_code", deptArray);
    const byRole = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("form_action_permission")
      .select("form_code, action_code")
      .eq("type", "role")
      .in("target_code", roleArray);
    const data = [
      ...safeData(byUser),
      ...safeData(byDept),
      ...safeData(byRole),
    ];
    return data;
  } catch (err) {
    console.error("Error fetching permissions:", err.message);
    throw new Error("Failed to fetch permissions");
  }
};

const getAttachmentPermissions = async (username, deptArray, roleArray) => {
  try {
    const byUser = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("attachment_permission")
      .select(
        "form_code, file_category, allow_preview, allow_download, allow_replace",
      )
      .eq("type", "user")
      .eq("target_code", username);
    const byDept = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("attachment_permission")
      .select(
        "form_code, file_category, allow_preview, allow_download, allow_replace",
      )
      .eq("type", "dept")
      .in("target_code", deptArray);
    const byRole = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("attachment_permission")
      .select(
        "form_code, file_category, allow_preview, allow_download, allow_replace",
      )
      .eq("type", "role")
      .in("target_code", roleArray);
    const data = [
      ...safeData(byUser),
      ...safeData(byDept),
      ...safeData(byRole),
    ];
    return data;
  } catch (err) {
    console.error("Error fetching permissions:", err.message);
    throw new Error("Failed to fetch permissions");
  }
};

const getMFAPass = async (dept) => {
  const { count, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("MFA_pass")
    .select("id", { count: "exact" })
    .or(`passID.ilike.*${dept}*`);

  if (error) throw error;

  return (count ?? 0) > 0;
};

const secretKey = process.env.JWT_SECRET_KEY;
const secretKeyMFA = process.env.JWT_SECRET_KEY_MFA;
const upload = multer();

const errorMessages = {
  invalidCredentials: "Sorry, Username Or Password Error！",
  serverError: "伺服器錯誤",
  missingData: "請填入完整的用戶資料",
  timeout: "認證時間已逾時",
  fail: "認證失敗",
};

const sendMFARequest = async (loginName) => {
  try {
    const application = "workflowtoWeb";
    const applicationCredential = "KeyOfWebAPIApplication";
    const timeStamp = Math.floor(Date.now() / 1000);
    const param = {
      application,
      applicationCredential,
      name: loginName,
      timeStamp,
    };

    const url = "https://idexpert-planbear.example.com.tw/login/push";
    const method = "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(param),
    });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();

    if (data.errorCode === 0) {
      return "success";
    } else if (data.errorCode === "66251") {
      return "timeout";
    } else {
      return "fail";
    }
  } catch (error) {
    console.error("Error:", error.message);
    return "fail";
  }
};

// async function getData() {
//   try {
//     const { data, error } = await supabase.from('users').select();
//     if (error) throw error; // 抛出錯誤
//     return data;
//   } catch (err) {
//     console.error('Error fetching data from Supabase:', err);
//     throw new Error(errorMessages.serverError);
//   }
// }

// 路徑POST /api/users：新增用戶（用戶資料包含 id, name, age）。
router.post("/", upload.none(), async (req, res) => {
  await logAction(`POST /login`, "info", req, req.body.username);
  try {
    // 從body內取得User資料
    const { username, password } = req.body;

    // 檢查是否有缺少的User資料
    if (!username || !password) {
      await logUserAction({
        user: req.body,
        action: "login_failed",
        module: "Auth",
        detail: JSON.stringify({
          status: "error",
          reason: errorMessages.missingData,
        }),
        req,
      });

      await logAction(`Auth login failed: missing data`, "warn", req);

      return res.status(400).json({
        status: "error",
        message: errorMessages.missingData,
      });
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      await logUserAction({
        user: req.body,
        action: "login_failed",
        module: "Auth",
        detail: JSON.stringify({
          status: "error",
          reason: "Invalid username format",
        }),
        req,
      });

      await logAction(`Auth login failed: invalid username`, "warn", req);

      return res.status(400).json({
        status: "error",
        message: "Invalid username format",
      });
    }

    if (
      (username === "admin" && password === "admin12345") ||
      (isMock && password === "1234")
    ) {
      const isDemoLogin = isMock && password === "1234";
      const userData = {
        username: username,
        name: username,
        ...(isDemoLogin
          ? {
              isDemo: true,
              needsRoleSelection: true,
              dept: [],
              role: [],
              permissions: {
                modules: [],
                forms: [],
                attachments: [],
              },
            }
          : {}),
      };

      const accessToken = jwt.sign(userData, secretKey, {
        expiresIn: "10h",
      });

      res.cookie("accessToken", accessToken, cookieOptions);

      await logUserAction({
        user: req.body,
        action: "login",
        module: "Auth",
        detail: JSON.stringify({
          status: "success",
          reason: "admin登入成功",
        }),
        req,
      });

      await logAction(`Auth login success for ${username}`, "info", req);
      res.status(201).json({
        status: "success",
        message: "登入成功",
        data: { user: userData },
      });
      return;
    }

    let usernameAd = "pht2\\" + username.toString();

    if (
      process.env.NODE_ENV !== "local" &&
      process.env.NODE_ENV !== "development"
    ) {
      await authenticateAD(usernameAd, password);
    } else {
      if (password !== "1234") {
        return res.status(401).json({
          status: "error",
          message: errorMessages.invalidCredentials,
        });
      }
    }
    const data = await getUserData(username);

    if (!data) {
      const userData = {
        username: username,
        name: username,
      };
      await logUserAction({
        user: userData,
        action: "mfa_failed",
        module: "Auth",
        detail: JSON.stringify({
          status: "error",
          reason: errorMessages.invalidCredentials,
        }),
        req,
      });

      await logAction(`[MFA] Invalid credentials`, "warn", req);
      return res.status(401).json({
        status: "error",
        message: errorMessages.invalidCredentials,
      });
    }

    const checkMFAPass = await getMFAPass(data.dept);

    if (checkMFAPass) {
      const deptData = await getDept(data.dept); //權限控管
      const deptArr = deptData.map((item) => item.dept);
      const last = deptArr[deptArr.length - 1].up_dept;
      if (last) deptArr.push(last);

      const roleData = await getRole(username, deptArr);
      const permissionData = await getUserPermissions(
        username,
        deptArr,
        roleData,
      ); //權限控管
      const factoryContext = await resolveFactoryContextOnLogin(username);

      const userData = {
        username: data.username,
        name: `${data.ename} ${data.fullname}`,
        email: data.email,
        dept_name: data.dept_name,
        dept: deptArr,
        role: roleData,
        factory: factoryContext.factory,
        permissions: permissionData, //權限控管
      };
      console.log(userData);
      const accessToken = jwt.sign(userData, secretKey, {
        expiresIn: "10h",
      });
      await logUserAction({
        user: { username: userData.username },
        action: "mfapass_success",
        module: "Auth",
        detail: JSON.stringify({
          status: "success",
          reason: "MFAPass驗證成功",
        }),
        req,
      });

      await logAction(
        `[MFAPass] MFAPass success`,
        "info",
        req,
        userData.username,
      );

      res.cookie("accessToken", accessToken, cookieOptions);

      res.status(201).json({
        status: "success",
        message: "MFAPass驗證成功",
        data: { user: userData },
      });
      return;
    }

    const MFAToken = jwt.sign({ username }, secretKeyMFA, {
      expiresIn: "10m",
    });

    res.cookie("accessToken", accessToken, cookieOptions);

    await logUserAction({
      user: req.body,
      action: "login",
      module: "Auth",
      detail: JSON.stringify({
        status: "success",
        reason: "一階段驗證成功",
      }),
      req,
    });

    await logAction(`first login success`, "info", req);

    res.status(201).json({
      status: "success",
      message: "一階段驗證成功",
    });
  } catch (error) {
    await logUserAction({
      user: req.body,
      action: "login_failed",
      module: "Auth",
      detail: JSON.stringify({
        status: "error",
        reason: error || errorMessages.serverError,
      }),
      req,
    });
    await logAction(`login failed`, "error", req, req.body.username);
    res.status(500).json({
      status: "error",
      message: error || errorMessages.serverError,
    });
  }
});

router.get("/demo-roles", async (req, res) => {
  if (!isMock || !req.user?.isDemo) {
    return res.status(403).json({
      status: "error",
      message: "Demo role selection is not available",
    });
  }

  try {
    const roles = getMockDemoRoles();

    return res.status(200).json({
      status: "success",
      data: { roles },
    });
  } catch (error) {
    console.error("Error fetching demo roles:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch roles",
    });
  }
});

router.post("/select-role", upload.none(), async (req, res) => {
  if (!isMock || !req.user?.isDemo || !req.user?.needsRoleSelection) {
    return res.status(403).json({
      status: "error",
      message: "Demo role selection is not available",
    });
  }

  try {
    const requestedRoleCodes = Array.isArray(req.body.role_codes)
      ? req.body.role_codes
      : [];
    const roleCodes = [
      ...new Set(
        requestedRoleCodes.filter((roleCode) => typeof roleCode === "string"),
      ),
    ];
    const roles = getMockDemoRoles();
    const validRoleCodes = new Set(roles.map((role) => role.role_code));

    if (
      roleCodes.length === 0 ||
      roleCodes.some((roleCode) => !validRoleCodes.has(roleCode))
    ) {
      return res.status(400).json({
        status: "error",
        message: "Please select at least one valid role",
      });
    }

    const permissionData = getMockDemoRolesPermissions(roleCodes);
    const userData = {
      username: req.user.username,
      name: req.user.name || req.user.username,
      isDemo: true,
      dept: [],
      role: roleCodes,
      factory: req.user.factory || null,
      permissions: permissionData,
    };
    const accessToken = jwt.sign(userData, secretKey, {
      expiresIn: "10h",
    });

    res.cookie("accessToken", accessToken, cookieOptions);

    await logAction(
      `Demo roles selected: ${roleCodes.join(", ")}`,
      "info",
      req,
      req.user.username,
    );

    return res.status(200).json({
      status: "success",
      message: "Role selected successfully",
      data: { user: userData },
    });
  } catch (error) {
    console.error("Error selecting demo role:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Failed to select role",
    });
  }
});

router.post("/MFA", upload.none(), async (req, res) => {
  await logAction(`POST /login/MFA`, "info", req);
  const token =
    req.cookies.MFAToken || req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    await logUserAction({
      user: req.user,
      action: "mfa_failed",
      module: "Auth",
      detail: JSON.stringify({
        status: "error",
        reason: "Token is missing",
      }),
      req,
    });

    await logAction(`[MFA] Token is missing`, "warn", req);
    return res
      .status(403)
      .json({ status: "error", data: { message: "Token is missing" } });
  }

  try {
    const decoded = jwt.verify(token, secretKeyMFA);
    req.user = decoded;
  } catch (err) {
    await logUserAction({
      user: req.user,
      action: "mfa_failed",
      module: "Auth",
      detail: JSON.stringify({
        status: "error",
        reason: "Token is invalid or expired",
      }),
      req,
    });

    await logAction(`[MFA] Token is invalid or expired`, "warn", req);
    return res.status(403).json({
      status: "error",
      data: { message: "Token is invalid or expired" },
    });
  }
  const { username } = req.user;
  res.clearCookie("MFAToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 10 * 60 * 60 * 1000,
    path: "/",
  });
  if (
    process.env.NODE_ENV !== "local" &&
    process.env.NODE_ENV !== "development"
  ) {
    const mfaResult = await sendMFARequest(username);

    if (mfaResult === "fail") {
      await logUserAction({
        user: req.user,
        action: "mfa_failed",
        module: "Auth",
        detail: JSON.stringify({
          status: "error",
          reason: errorMessages.fail,
        }),
        req,
      });

      await logAction(`[MFA] MFA failed`, "warn", req);
      return res.status(403).json({
        status: "error",
        message: errorMessages.fail,
      });
    } else if (mfaResult === "timeout") {
      await logUserAction({
        user: req.user,
        action: "mfa_failed",
        module: "Auth",
        detail: JSON.stringify({
          status: "error",
          reason: errorMessages.timeout,
        }),
        req,
      });

      await logAction(`[MFA] MFA timeout`, "warn", req);
      return res.status(403).json({
        status: "error",
        message: errorMessages.timeout,
      });
    }
  }

  const data = await getUserData(username);
  if (!data) {
    await logUserAction({
      user: req.user,
      action: "mfa_failed",
      module: "Auth",
      detail: JSON.stringify({
        status: "error",
        reason: errorMessages.invalidCredentials,
      }),
      req,
    });

    await logAction(`[MFA] Invalid credentials`, "warn", req);
    return res.status(401).json({
      status: "error",
      message: errorMessages.invalidCredentials,
    });
  }
  const factoryContext = await resolveFactoryContextOnLogin(username);
  const deptData = await getDept(data.dept); //權限控管
  const deptArr = deptData.map((item) => item.dept);
  const last = deptArr[deptArr.length - 1].up_dept;

  if (last) deptArr.push(last);

  const roleData = await getRole(username, deptArr);
  const permissionData = await getUserPermissions(username, deptArr, roleData); //權限控管
  const userData = {
    username: data.username,
    name: `${data.ename} ${data.fullname}`,
    email: data.email,
    dept_name: data.dept_name,
    dept: deptArr,
    role: roleData,
    factory: factoryContext.factory,
    permissions: permissionData, //權限控管
  };
  console.log(userData);

  const accessToken = jwt.sign(userData, secretKey, {
    expiresIn: "10h",
  });
  await logUserAction({
    user: req.user,
    action: "mfa_success",
    module: "Auth",
    detail: JSON.stringify({
      status: "success",
      reason: "二階段驗證成功",
    }),
    req,
  });

  await logAction(`[MFA] MFA success`, "info", req);

  res.cookie("accessToken", accessToken, cookieOptions);

  res.status(201).json({
    status: "success",
    message: "二階段驗證成功",
    data: { user: userData },
  });
});

export default router;
