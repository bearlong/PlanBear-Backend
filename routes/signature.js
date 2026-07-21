import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import sql from "mssql";
import mssql from "../configs/mssql.js";
import xml2js from "xml2js";
import { logAction } from "../utils/useLogger.js";

const isMock = process.env.USE_MOCK === "true";
const pool = isMock ? null : await mssql();

/**
 * @swagger
 * /signature:
 *   get:
 *     summary: Get signature tasks
 *     tags:
 *       - Signature
 *     description: Retrieve pending signature tasks for the current user (decoded from JWT) and optionally filter by title.
 *     parameters:
 *       - in: query
 *         name: title
 *         description: Filter by title keyword (partial match).
 *         required: false
 *         schema:
 *           type: string
 *           example: "RFQ"
 *     responses:
 *       200:
 *         description: Success, signature tasks retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Signature tasks retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                         example: "RFQ Approval"
 *                       version:
 *                         type: string
 *                         example: "1.0"
 *                       applyName:
 *                         type: string
 *                         example: "Bear Shen"
 *                       enterDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-02-04T08:53:57.080Z"
 *                       activeId:
 *                         type: integer
 *                         example: 12345
 *                       formUrl:
 *                         type: string
 *                         example: "https://workflow.example.com/forms/123?real=true"
 *                       description:
 *                         type: string
 *                         example: "RFQ approval flow"
 *                       nodeLevel:
 *                         type: integer
 *                         example: 2
 *                       actorId:
 *                         type: integer
 *                         example: 67890
 *                       batchType:
 *                         type: string
 *                         example: "N"
 *                       originalName:
 *                         type: string
 *                         example: "Original Approver"
 *                       flowId:
 *                         type: integer
 *                         example: 1001
 *                       addSign:
 *                         type: string
 *                         example: "N"
 *                       stepsId:
 *                         type: integer
 *                         example: 10
 *                       roleId:
 *                         type: integer
 *                         example: 5
 *                       memo1:
 *                         type: string
 *                         example: "Memo line 1"
 *                       memo2:
 *                         type: string
 *                         example: "Memo line 2"
 *                       memo3:
 *                         type: string
 *                         example: "Memo line 3"
 *                       ifOpen:
 *                         type: string
 *                         example: "Y"
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

const mockData = () => [
  {
    title: "Vendor Compare Price",
    version: "1",
    applyName: "Bear Shen",
    enterDate: "2025-02-27T08:53:57.080Z",
    activeId: 2025020002,
    formUrl: "/workflow/2025020002",
    description: "3.直屬主管",
    nodeLevel: 1,
    actorId: 1001,
    batchType: "N",
    originalName: "",
    flowId: 5001,
    addSign: "N",
    stepsId: 10,
    roleId: 5,
    memo1: "Apply No: 2025020001",
    memo2: " /VENDOR Compare Price：2025050002_V2 Type：C",
    memo3: "Status: Sign",
    ifOpen: "Y",
  },
  {
    title: "RFQ Approval",
    version: "1",
    applyName: "Admin User",
    enterDate: "2025-03-01T09:15:00.000Z",
    activeId: 2025030002,
    formUrl: "/workflow/2025030002",
    description: "5.採購主管",
    nodeLevel: 2,
    actorId: 1002,
    batchType: "N",
    originalName: "",
    flowId: 5002,
    addSign: "N",
    stepsId: 20,
    roleId: 6,
    memo1: "Mock RFQ task",
    memo2: " /VENDOR Compare Price：2025050001_V2 Type：C",

    memo3: "",
    ifOpen: "N",
  },
];

function getMockData(title) {
  const data = mockData();
  if (!title) return data;

  const normalizedTitle = title.trim().toLowerCase();
  return data.filter((item) =>
    item.title.toLowerCase().includes(normalizedTitle),
  );
}

const getMemberId = async (username) => {
  const user = await pool.request().input("username", username).query(`
          SELECT Member_GUID FROM OC_Member WHERE Member_Name = @username
      `);
  console.log(user.recordset[0]);
  if (!user.recordset[0]) return null;
  return user.recordset[0]?.Member_GUID;
};

const getDataMssql = async (V_memberid) => {
  try {
    // 取得資料庫池連接
    let tTLCollection = [];

    // 取得 flowctl 資料
    const flowctlResult = {
      // 這裡假設 flowctlResult 是從資料庫查詢得到的結果
    };

    // 取得 activity 資料
    const activityResult = {
      // 這裡假設 activityResult 是從資料庫查詢得到的結果
    };

    const flowctlMap = new Map();
    flowctlResult.recordset.forEach((row) => {
      flowctlMap.set(row.fid, row);
    });

    for (const row of activityResult.recordset) {
      const flowctlRow = flowctlMap.get(row.fid);
      if (flowctlRow) {
        const roleTitleParts = row.roletitle ? row.roletitle.split("&") : [];
        const originalName = roleTitleParts.length > 1 ? roleTitleParts[1] : "";

        const ttlItem = {
          title: row.TTLTitle.replace(/&|<|>/g, ""),
          version: row.version,
          applyName: row.applyname,
          enterDate: row.enterdate,
          activeId: row.ActiveID,
          formUrl: `${flowctlRow.formid}?real=true&activeid=${
            row.ActiveID
          }&actorid=${row.actorid}&timestamp=${Date.now()}`,
          description: flowctlRow.desp.replace(/&|<|>/g, ""),
          nodeLevel: flowctlRow.nodelevel,
          actorId: row.actorid,
          batchType: flowctlRow.BatchType,
          originalName: originalName,
          flowId: row.flowid,
          addSign: flowctlRow.AddSign,
          stepsId: row.stepsid,
          roleId: row.roleid,
          memo1: row.Memo1Str,
          memo2: row.Memo2Str,
          memo3: row.Memo3Str,
          ifOpen: row.ifopen,
        };

        tTLCollection.push(ttlItem);
      }
    }

    return tTLCollection;
  } catch (error) {
    console.error("getAllTTL error:", error);
    throw new Error("Error fetching TTL data.");
  }
};

function parseXML(xmlText) {
  return new Promise((resolve, reject) => {
    const parser = new xml2js.Parser();
    parser.parseString(xmlText, (err, result) => {
      if (err) {
        reject("XML 解析錯誤: " + err);
      } else {
        resolve(result);
      }
    });
  });
}

async function getworkflowFormUrl(activeId, accountName) {
  const url = `${process.env.workflow_URL}workspace/flowservice.asmx/getFormUrl`;
  const data = {
    activeId,
    accountName,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(data), // 將 data 轉換為 URL 查詢字串
    });

    if (response.ok) {
      // 將回應的 XML 內容轉換為 XMLDocument
      const xmlText = await response.text(); // 取得回應的 XML 內容

      // 使用 Promise 來包裝 xml2js 的解析，讓它支持 async/await
      const result = await parseXML(xmlText);

      // 提取 string 屬性 _ 中的值
      const formUrl = result.string._; // 提取 '_'
      return formUrl;
    } else {
      console.error("請求失敗:", response.statusText);
    }
  } catch (error) {
    console.error("請求失敗:", error.message);
  }
}

router.get("/", async (req, res) => {
  const { username } = req.user;
  const { title } = req.query;
  await logAction(`GET /signature`, "info", req);
  try {
    if (isMock) {
      const data = getMockData(title);
      await logAction(`Mock found ${data.length} signature`, "info", req);

      return res.status(200).json({
        status: "success",
        message: "Signature tasks retrieved successfully (mock)",
        data,
      });
    }

    const memberId = await getMemberId(username);
    if (!memberId) {
      await logAction(`No member found for ${username}`, "warn", req);

      return res.status(200).json({
        status: "error",
        message: "找不到使用者。",
      });
    }

    let data = await getDataMssql(memberId);
    if (data.length === 0) {
      await logAction(`No data found for ${username}`, "warn", req);
      console.log(`first`, data.length);

      return res.status(200).json({
        status: "error",
        message: "找不到資料。",
      });
    }
    if (title) {
      data = data.filter((ttlItem) => ttlItem.title.includes(title));
    }
    // 加入 formUrl
    const formUrlsPromises = data.map(async (ttlItem) => {
      ttlItem.formUrl = await getworkflowFormUrl(ttlItem.activeId, username);
    });

    await Promise.all(formUrlsPromises); // 等待所有 formUrl 都處理完成

    await logAction(`Found ${data.length} signature`, "info", req);

    res.status(200).json({
      status: "success",
      message: "已成功撈取資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /signature: ${error.message}`,
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
