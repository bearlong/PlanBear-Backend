import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../configs/supabase.js";
import PDMsql from "../configs/PDMsql.js";
import sql from "mssql";
import { writeFile } from "fs/promises";
import { existsSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import pLimit from "p-limit";
import { fileURLToPath } from "url";
import xml2js from "xml2js";
import moment from "moment";
import { logAction, logUserAction } from "#utils/useLogger.js";
import { addPendingTasks, finishPendingTask } from "#utils/usePendingTask.js";
import {
  cloneMockCompareData,
  mockCompareStore,
  nextMockApplyNo,
} from "../configs/mockCompareStore.js";
const isMock = process.env.USE_MOCK === "true";

const mockReferenceData = {
  factories: [
    { code: "PB00", name: "熊計畫股份有限公司" },
    { code: "VB00", name: "熊計畫(越南)股份有限公司" },
  ],
  vendors: [
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
  brands: [
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
  parts: [
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
  buyers: [
    {
      code: "A01",
      name: "大強",
      username: "3376",
      factory: "TXG",
    },
    {
      code: "C01",
      name: "許傳民",
      username: "7125",
      factory: "TPE",
    },
    {
      code: "C02",
      name: "王小明",
      username: "7126",
      factory: "TAO",
    },
  ],
  countries: [{ code: "TW" }, { code: "UK" }, { code: "US" }, { code: "CN" }],
  lastPrices: [
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
  ],
};

const parseMockValue = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getStoredMockApply = (applyNo, activeId, version) => {
  const items = mockCompareStore.applications.filter(({ compare_data }) => {
    const applyMatch =
      applyNo && String(compare_data.apply_no) === String(applyNo);
    const activeMatch =
      activeId && String(compare_data.activeid) === String(activeId);
    const versionMatch =
      !version || Number(compare_data.version) === Number(version);
    return (applyMatch || activeMatch) && versionMatch;
  });
  const item = items.sort(
    (a, b) => Number(b.compare_data.version) - Number(a.compare_data.version),
  )[0];
  return item ? cloneMockCompareData(item) : null;
};

const getStoredMockDraft = (draftNo) => {
  const item = mockCompareStore.drafts.find(
    ({ compare_data_draft }) => compare_data_draft.draft_no === draftNo,
  );
  return item ? cloneMockCompareData(item) : null;
};

const getMockBuyerByUsername = (username) => {
  if (!username) return null;
  return mockReferenceData.buyers.find(
    (buyer) => String(buyer.username) === String(username),
  );
};

const getMockApplyBuyer = (item) => {
  const buyerUsername =
    item.BuyerUsername ??
    item.Buyer?.username ??
    (typeof item.Buyer === "string" ? item.Buyer : null);
  const buyer = getMockBuyerByUsername(buyerUsername);

  if (buyer) {
    return {
      username: buyer.username,
      name: buyer.name,
      code: buyer.code,
    };
  }

  if (item.Buyer && typeof item.Buyer === "object") return item.Buyer;

  return {
    username: buyerUsername ?? "mock",
    name: buyerUsername ?? "Mock Buyer",
    code: item.BuyerCode ?? "",
  };
};

const getMockApplyCodeObject = (code, display) => ({
  display: display ?? (code ? `(${code}) ${code}` : ""),
  code: code ?? "",
});

const normalizeMockDetails = (data = []) =>
  data.map((item, index) => ({
    id: item.id ?? `${Date.now()}_${index}`,
    Factory: getMockApplyCodeObject(
      item.Factory?.code ?? item.Factory,
      item.FactoryDisplay ?? item.Factory?.display,
    ),
    Vendor: getMockApplyCodeObject(
      item.Vendor?.code ?? item.Vendor,
      item.VendorDisplay ?? item.Vendor?.display,
    ),
    Brand: getMockApplyCodeObject(
      item.Brand?.code ?? item.Brand,
      item.BrandDisplay ?? item.Brand?.display,
    ),
    Parts: item.Parts ?? "",
    Description: item.Description ?? "",
    OrderSharerate: item.OrderSharerate ?? "",
    LastPutPrice: item.LastPutPrice ?? "",
    CurrencyOld: item.CurrencyOld ?? "",
    UnitPrice: item.UnitPrice ?? "",
    CurrencyNew: item.CurrencyNew ?? "",
    Rate: item.Rate ?? "",
    EffectiveDate: item.EffectiveDate ?? "",
    EffectiveRemark: item.EffectiveRemark ?? "",
    CostDown: item.CostDown ?? "",
    Moq: item.Moq ?? "",
    Mpq: item.Mpq ?? "",
    LeadTime: item.LeadTime ?? "",
    LME: item.LME ?? "",
    QuotaDate: item.QuotaDate ?? "",
    AnnulmentDate: item.AnnulmentDate ?? null,
    ControlQuantity: item.ControlQuantity ?? "",
    VendorQuotationNo: item.VendorQuotationNo ?? "",
    Buyer: getMockApplyBuyer(item),
    AttachFile: item.AttachFile ?? [],
    IsSpotPrice: item.IsSpotPrice ?? "N",
    IsUnpaidOrderEffective: item.IsUnpaidOrderEffective ?? "N",
    PlaceOfOrigin: Array.isArray(item.PlaceOfOrigin)
      ? JSON.stringify(item.PlaceOfOrigin)
      : (item.PlaceOfOrigin ?? "[]"),
    type: item.type ?? "AP",
  }));

const normalizeMockCodeObject = (value, existing) => {
  if (value && typeof value === "object") return value;
  if (typeof value === "string" && value) {
    if (existing?.code === value) return existing;
    return {
      code: value,
      display: `(${value}) ${value}`,
    };
  }
  return existing ?? null;
};

const normalizeMockBuyerObject = (value, existing) => {
  if (value && typeof value === "object") return value;
  if (typeof value === "string" && value) {
    if (existing?.username === value) return existing;
    return {
      username: value,
      name: value,
    };
  }
  return existing ?? null;
};

const normalizeMockDraftDetails = (data = [], existingDetails = []) =>
  data.map((item, index) => {
    const existing =
      existingDetails.find((detail) => String(detail.id) === String(item.id)) ??
      existingDetails[index] ??
      {};

    return {
      ...item,
      id: item.id ?? `${Date.now()}_${index}`,
      Factory: normalizeMockCodeObject(item.Factory, existing.Factory),
      Vendor: normalizeMockCodeObject(item.Vendor, existing.Vendor),
      Brand: normalizeMockCodeObject(item.Brand, existing.Brand),
      Buyer: normalizeMockBuyerObject(item.Buyer, existing.Buyer),
      PlaceOfOrigin: Array.isArray(item.PlaceOfOrigin)
        ? JSON.stringify(item.PlaceOfOrigin)
        : item.PlaceOfOrigin,
    };
  });

const normalizeMockDraftBuyer = (buyer, existingBuyer, user) => {
  if (buyer && typeof buyer === "object") return buyer;
  if (typeof buyer === "string") {
    return {
      username: buyer,
      name: user?.username === buyer ? (user?.name ?? buyer) : buyer,
    };
  }
  return (
    existingBuyer ?? {
      username: user?.username ?? "mock",
      name: user?.name ?? "Mock User",
    }
  );
};

const normalizeMockDraftSourcer = (
  sapSourcer,
  sapSourcerUsername,
  existing,
) => {
  if (sapSourcer && typeof sapSourcer === "object") return sapSourcer;
  if (typeof sapSourcer === "string" && sapSourcer) {
    if (existing?.code === sapSourcer) return existing;
    return {
      code: sapSourcer,
      name: sapSourcer,
      username: sapSourcerUsername ?? sapSourcer,
    };
  }
  return existing ?? null;
};

const upsertStoredMockDraft = ({ draftNo, title, data, user }) => {
  const parsedTitle = parseMockValue(title, {});
  const parsedData = parseMockValue(data, []);
  let item = mockCompareStore.drafts.find(
    ({ compare_data_draft }) => compare_data_draft.draft_no === draftNo,
  );
  const created = !item;

  if (!item) {
    item = {
      compare_data_draft: {
        draft_no: draftNo,
        status: "draft",
      },
      compare_apply_draft: [],
    };
    mockCompareStore.drafts.push(item);
  }

  item.compare_data_draft = {
    ...item.compare_data_draft,
    ...parsedTitle,
    draft_no: draftNo,
    buyer: normalizeMockDraftBuyer(
      parsedTitle.buyer,
      item.compare_data_draft.buyer,
      user,
    ),
    sap_sourcer: normalizeMockDraftSourcer(
      parsedTitle.sap_sourcer,
      parsedTitle.sap_sourcer_username,
      item.compare_data_draft.sap_sourcer,
    ),
    status: parsedTitle.status ?? item.compare_data_draft.status ?? "draft",
    updated_at: new Date().toISOString(),
  };
  item.compare_apply_draft = normalizeMockDraftDetails(
    parsedData,
    item.compare_apply_draft,
  );

  return { item, created };
};

const createStoredMockApply = ({
  applyNo,
  version = 1,
  title,
  data,
  company,
  user,
}) => {
  const apply_no = applyNo ?? nextMockApplyNo();
  const parsedTitle = parseMockValue(title, {});
  const parsedData = parseMockValue(data, []);
  const activeid = `${apply_no}_V${version}`;

  const stored = {
    compare_data: {
      sign_number: `SG${mockCompareStore.applications.length + 1}`,
      apply_no,
      buyer: {
        username: user?.username ?? "mock",
        name: user?.name ?? "Mock User",
      },
      apply_date:
        parsedTitle.apply_date ?? new Date().toISOString().slice(0, 10),
      sap_sourcer: {
        code: parsedTitle.sap_sourcer,
        name: parsedTitle.sap_sourcer_name,
        username: parsedTitle.sap_sourcer_username,
      },
      sap_sourcer_username: parsedTitle.sap_sourcer_username ?? null,
      status: version === 1 ? "Sign" : "resend",
      version: Number(version),
      company_code: company,
      memo: parsedTitle.memo ?? "",
      sign_route: parsedTitle.sign_route ?? null,
      activeid,
      updated_at: new Date().toISOString(),
    },
    compare_apply: normalizeMockDetails(parsedData),
    comments: [],
  };

  mockCompareStore.applications.push(stored);
  return stored;
};

/**
 * @swagger
 * /compare-apply:
 *   get:
 *     summary: Get compare-apply info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve the VENDOR Compare Price form detail for apply_no. Returns data in JSON format.
 *     parameters:
 *       - in: query
 *         name: applyNo
 *         description: ApplyNo used to retrieve the column headers.
 *         required: true
 *         schema:
 *           type: string
 *           example: "2025020001"
 *     responses:
 *       200:
 *         description: Successfully retrieved the VENDOR Compare Price form detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "已找到資料"
 *                 data:
 *                   type: object
 *                   properties:
 *                     compare_data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: number
 *                           example: 2
 *                         created_at:
 *                           type: date-time
 *                           example: '2025-02-27T05:28:03.800264+00:00'
 *                         sign_number:
 *                           type: string
 *                           example: 'SG2'
 *                         buyer:
 *                           type: object
 *                           properties:
 *                             username:
 *                                type: string
 *                                example: '8892'
 *                             name:
 *                                type: string
 *                                example: 'Bear_Shen 沈正龍'
 *                         apply_no:
 *                           type: string
 *                           example: '2025020002'
 *                         apply_date:
 *                           type: date-time
 *                           example: '2025-02-27'
 *                         memo:
 *                           type: string
 *                           example: "test"
 *                         sap_sourcer::
 *                           type: object
 *                           properties:
 *                             username:
 *                                type: string
 *                                example: '8892'
 *                             name:
 *                                type: string
 *                                example: 'Bear_Shen 沈正龍'
 *                             code:
 *                                type: string
 *                                example: 'T04'
 *                         status:
 *                           type: string
 *                           example: 'Sign'
 *                         end_date:
 *                           type: date-time
 *                           example: '2025-02-27'
 *                         sap_sourcer_username:
 *                           type: string
 *                           example: '60340'
 *                         sign_route:
 *                           type: string
 *                           example: "A"
 *                     compare_apply:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: number
 *                           example: 1742189251504
 *                         Factory:
 *                           type: object
 *                           properties:
 *                             display:
 *                               type: string
 *                               example: '飛宏(東莞)電子有限公司'
 *                             code:
 *                               type: string
 *                               example: 'CC00'
 *                         Vendor:
 *                           type: object
 *                           properties:
 *                             display:
 *                               type: string
 *                               example: '(0001590)晟鈦股份有限公司'
 *                             code:
 *                               type: string
 *                               example: '0001590'
 *                         Brand:
 *                           type: object
 *                           properties:
 *                             display:
 *                               type: string
 *                               example: '(MA0065)長盛'
 *                             code:
 *                               type: string
 *                               example: 'MA0065'
 *                         Parts:
 *                           type: string
 *                           example: '102M1H472RS-R00'
 *                         Description:
 *                           type: string
 *                           example: 'CC 4700PF 50V +-20% Z5U TS5'
 *                         OrderSharerate:
 *                           type: string
 *                           example: '20'
 *                         LastPutPrice:
 *                           type: string
 *                           example: "0"
 *                         CurrencyOld:
 *                           type: string
 *                           example: 'TWD'
 *                         Rate:
 *                           type: string
 *                           example: ""
 *                         EffectiveDate:
 *                           type: date-time
 *                           example: '2024-01-06'
 *                         EffectiveRemark:
 *                           type: string
 *                           example: '20'
 *                         CostDown:
 *                           type: string
 *                           example: ""
 *                         Moq:
 *                           type: string
 *                           example: '20'
 *                         Mpq:
 *                           type: string
 *                           example: '2'
 *                         LeadTime:
 *                           type: string
 *                           example: '2'
 *                         LME:
 *                           type: string
 *                           example: "2"
 *                         QuotaDate:
 *                           type: date-time
 *                           example: '2024-01-11'
 *                         AnnulmentDate:
 *                           type: date-time
 *                           example: '2024-01-11'
 *                         ControlQuantity:
 *                           type: string
 *                           example: "20"
 *                         VendorQuotationNo:
 *                           type: string
 *                           example: "20"
 *                         Buyer:
 *                           type: object
 *                           properties:
 *                             username:
 *                               type: string
 *                               example: '7147'
 *                             name:
 *                               type: string
 *                               example: '林俊宏'
 *                             code:
 *                               type: string
 *                               example: 'T03'
 *                         AttachFile:
 *                           type: array
 *                           example: []
 *                         IsSpotPrice:
 *                           type: string
 *                           example: "Y"
 *                         IsUnpaidOrderEffective:
 *                           type: string
 *                           example: "Y"
 *                         PlaceOfOrigin:
 *                           type: array
 *                           example: ["TW 台灣", "UK 英國"]
 *                         type:
 *                           type: string
 *                           example: "AP"
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
 *   post:
 *     summary: Create column headers and details for the VENDOR Compare Price form
 *     tags:
 *       - VENDOR Compare Price
 *     description: Create a new VENDOR Compare Price form, including column headers and form details.
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: data
 *         description: Data array containing form values.
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: '1742262470622'
 *               Factory:
 *                 type: string
 *                 example: 'PP01'
 *               Vendor:
 *                 type: string
 *                 example: '0001654R'
 *               Brand:
 *                 type: string
 *                 example: 'MA0076'
 *               Parts:
 *                 type: string
 *                 example: '84A00800052-HA2'
 *               Description:
 *                 type: string
 *                 example: 'MANUAL KU12EA-R 80g ART PAPER'
 *               OrderSharerate:
 *                 type: string
 *                 example: '10'
 *               LastPutPrice:
 *                 type: string
 *                 example: '0'
 *               CurrencyOld:
 *                 type: string
 *                 example: 'USD'
 *               UnitPrice:
 *                 type: string
 *                 example: '10'
 *               CurrencyNew::
 *                 type: string
 *                 example: 'RMB'
 *               Rate:
 *                 type: string
 *                 example: '7.14'
 *               EffectiveDate:
 *                 type: date-time
 *                 example: '2025-03-20'
 *               EffectiveRemark:
 *                 type: string
 *                 example: '10'
 *               CostDown:
 *                 type: string
 *                 example: '0'
 *               Moq:
 *                 type: string
 *                 example: '10'
 *               Mpq:
 *                 type: string
 *                 example: '10'
 *               LeadTime:
 *                 type: string
 *                 example: '10'
 *               LME:
 *                 type: string
 *                 example: '0'
 *               QuotaDate:
 *                 type: date-time
 *                 example: '2025-03-20'
 *               AnnulmentDate:
 *                 type: date-time
 *                 example: '2025-03-20'
 *               ControlQuantity:
 *                 type: string
 *                 example: '10'
 *               VendorQuotationNo:
 *                 type: string
 *                 example: '10'
 *               Buyer:
 *                 type: string
 *                 example: 'T07'
 *               IsSpotPrice:
 *                 type: string
 *                 example: 'Y'
 *               IsUnpaidOrderEffective:
 *                 type: string
 *                 example: 'Y'
 *               PlaceOfOrigin:
 *                 type: string
 *                 example: '["AZ 亞塞拜然"]'
 *               type:
 *                 type: string
 *                 example: 'AP'
 *               FactoryDisplay::
 *                 type: string
 *                 example: '(PP01)東莞達宏電子有限公司-內銷'
 *               VendorDisplay:
 *                 type: string
 *                 example: '(0001654R)國巨(蘇州)銷售有限公司'
 *               BrandDisplay:
 *                 type: string
 *                 example: '(MA0076)HONG SHENG(東莞鴻盛織造)'
 *               BuyerUsername:
 *                 type: string
 *                 example: '8351'
 *       - in: formData
 *         name: signInfo
 *         description: Sign info array.
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               priority:
 *                 type: string
 *                 example: 'Normal'
 *               signRoute:
 *                 type: string
 *                 example: 'A'
 *       - in: formData
 *         name: title
 *         description: Title information.
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               buyer:
 *                 type: string
 *                 example: 'admin'
 *               apply_date:
 *                 type: date-time
 *                 example: '2025-03-18'
 *               memo::
 *                 type: string
 *                 example: '12345'
 *               sap_sourcer:
 *                 type: string
 *                 example: 'T04'
 *               sap_sourcer_username:
 *                 type: string
 *                 example: '60340'
 *               sign_route:
 *                 type: string
 *                 example: 'A'
 *       - in: formData
 *         name: file
 *         description: Files to be uploaded.
 *         required: false
 *         type: file
 *     responses:
 *       200:
 *         description: Successfully uploaded form data and files
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "所有資料成功寫入！"
 *                 data:
 *                   type: string
 *                   example: '20250301'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "🚨 有資料寫入失敗:' error"
 */

const getMockDraftDetailData = (draftNo) => {
  const mockDate = new Date().toISOString().split("T")[0];

  if (draftNo === `DRAFT_${mockDate}`) {
    return {
      compare_data_draft: {
        draft_no: draftNo,
        buyer: {
          username: "admin",
          name: "管理員",
        },
        memo: "",
        updated_at: "2023-01-01T00:00:00Z",
      },
      compare_apply_draft: [],
    };
  }
  return {
    compare_data_draft: {
      draft_no: draftNo,
      buyer: {
        username: "admin",
        name: "管理員",
      },
      sap_sourcer: {
        code: "C01",
        name: "許傳民",
        username: "7125",
      },
      memo: "This is a mock draft for testing purposes.",
      updated_at: "2023-01-01T00:00:00Z",
    },
    compare_apply_draft: [
      {
        id: "1",
        Factory: {
          display: "(PP01)東莞達宏電子有限公司-內銷", // 顯示用
          code: "PP01", // 傳輸後端用
        },
        Vendor: {
          display: "(0001654R)國巨(蘇州)銷售有限公司", // 顯示用
          code: "0001654R", // 傳輸後端用
        },
        Brand: {
          display: "(MA0076)HONG SHENG(東莞鴻盛織造)", // 顯示用
          code: "MA0076", // 傳輸後端用
        },
        Parts: "84A00800052-HA2",
        Description: "MANUAL KU12EA-R 80g ART PAPER",
        OrderSharerate: "10",
        LastPutPrice: "0",
        CurrencyOld: "USD",
        UnitPrice: "10",
        CurrencyNew: "RMB",
        Rate: "7.14",
        EffectiveDate: "2025-03-20",
        EffectiveRemark: "10",
        CostDown: "0",
        Moq: "10",
        Mpq: "10",
        LeadTime: "10",
        LME: "0",
        QuotaDate: "2025-03-20",
        AnnulmentDate: "2025-03-20",
        ControlQuantity: "10",
        VendorQuotationNo: "10",
        Buyer: "T07",
        IsSpotPrice: "Y",
        IsUnpaidOrderEffective: "Y",
        PlaceOfOrigin: '["AZ 亞塞拜然"]',
        type: "AP",
        Buyer: {
          username: "admin",
          name: "管理員",
        },
      },
    ],
  };
};

const getMockCompareApplyData = (applyNo, activeId, version) => {
  const mockDate = new Date().toISOString().split("T")[0];
  console.log(applyNo, activeId, version);
  if (applyNo === `2025020002` || activeId === "2025020002") {
    return {
      compare_data: {
        apply_no: applyNo,
        buyer: {
          username: "8892",
          name: "Bear_Shen 沈正龍",
        },
        sap_sourcer: {
          code: "C01",
          name: "許傳民",
          username: "7125",
        },
        memo: "This is a mock apply for testing purposes.",
        updated_at: "2023-01-01T00:00:00Z",
        activeId: activeId,
      },
      compare_apply: [
        {
          id: "1",
          Factory: {
            display: "(PP01)東莞達宏電子有限公司-內銷", // 顯示用
            code: "PP01", // 傳輸後端用
          },
          Vendor: {
            display: "(0001654R)國巨(蘇州)銷售有限公司", // 顯示用
            code: "0001654R", // 傳輸後端用
          },
          Brand: {
            display: "(MA0076)HONG SHENG(東莞鴻盛織造)", // 顯示用
            code: "MA0076", // 傳輸後端用
          },

          Parts: "84A00800052-HA2",
          Description: "MANUAL KU12EA-R 80g ART PAPER",
          OrderSharerate: "10",
          LastPutPrice: "0",
          CurrencyOld: "USD",
          UnitPrice: "10",
          CurrencyNew: "RMB",
          Rate: "7.14",
          EffectiveDate: "2025-03-20",
          EffectiveRemark: "10",
          CostDown: "0",
          Moq: "10",
          Mpq: "10",
          LeadTime: "10",
          LME: "0",
          QuotaDate: "2025-03-20",
          AnnulmentDate: "2025-03-20",
          ControlQuantity: "10",
          VendorQuotationNo: "10",
          Buyer: "T07",
          IsSpotPrice: "Y",
          IsUnpaidOrderEffective: "Y",
          PlaceOfOrigin: '["AZ 亞塞拜然"]',
          type: "AP",
        },
      ],
    };
  }
};

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const fileIcons = {
  // 文書類
  pdf: "/img/pdf.png",
  doc: "/img/word.png",
  docx: "/img/word.png",
  txt: "/img/txt.png",

  // 試算表類
  xls: "/img/excel.png",
  xlsx: "/img/excel.png",
  csv: "/img/excel.png",

  // 簡報類
  ppt: "/img/ppt.png",
  pptx: "/img/ppt.png",

  // 圖片類
  jpg: "/img/jpg.png",
  jpeg: "/img/jpg.png",
  png: "/img/jpg.png",

  // 壓縮檔案類
  zip: "/img/zip.png",
  rar: "/img/zip.png",

  // 預設
  default: "/img/other.png",
};

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

async function getData(applyNo = null, activeId = null, version = null) {
  try {
    let comments = [];
    // 料號權限控管
    // let query = supabase
    //   .schema(process.env.DB_SCHEMA)
    //   .from('compare_data')
    //   .select('*')
    //   .eq(applyNo ? 'apply_no' : 'activeId', applyNo ? applyNo : activeId);

    // if (version) {
    //   query = query.eq('version', version);
    // } else if (applyNo) {
    //   // ⬇️ 查出最大 version

    //   const { data: latestVerRow, error: verError } = await supabase
    //     .schema(process.env.DB_SCHEMA)
    //     .from('compare_data')
    //     .select('version')
    //     .eq('apply_no', applyNo)
    //     .order('version', { ascending: false })
    //     .limit(1)
    //     .maybeSingle();

    //   if (verError) throw verError;

    //   const maxVersion = latestVerRow?.version;
    //   if (maxVersion != null) {
    //     query = query.eq('version', maxVersion);
    //   }
    // }
    // const { data: compareData, error: compareError } = await query
    //   .order('version', { ascending: false })
    //   .limit(1)
    //   .maybeSingle();

    // if (!compareData) return { compare_data: null, compare_apply: null };
    // if (compareError) throw compareError;

    // const deptList = Array.isArray(user?.dept)
    //   ? user.dept
    //   : typeof user?.dept === 'string'
    //   ? user.dept.split(',')
    //   : [];
    // const deptCsv = deptList.find(Boolean) || ''; // 例如 'Z101TPD13,Z101TMB00'
    // const params = {
    //   p_dept_csv: deptCsv, // 例如 '60229'
    //   p_apply_no: compareData.apply_no,
    //   p_version: compareData.version,
    //   p_factory: company,
    // };
    // // ② 用精簡 RPC 抓「過濾後」的表身（不用 activeId）
    // const { data: compare_apply, error: applyError } = await supabase
    //   .schema(process.env.DB_SCHEMA)

    // if (applyError) throw applyError;

    // 1. 使用 Promise.all() 讓兩個不相依的查詢並行處理
    let query = supabase
      .schema(process.env.DB_SCHEMA)
      .from("compare_data")
      .select(
        "apply_no, version, buyer, sap_sourcer, apply_date, memo, status, end_date, company_code, compare_apply(*)",
      );
    if (applyNo) {
      query = query.eq("apply_no", applyNo);
    } else if (activeId) {
      query = query.eq("activeId", activeId);
    }
    if (version) {
      query = query.eq("version", version);
    } else if (applyNo) {
      // ⬇️ 查出最大 version
      const { data: latestVerRow, error: verError } = await supabase
        .schema(process.env.DB_SCHEMA)
        .from("compare_data")
        .select("version")
        .eq("apply_no", applyNo)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (verError) throw verError;

      const maxVersion = latestVerRow?.version;
      if (maxVersion != null) {
        query = query.eq("version", maxVersion);
      }
    }
    const { data: compareData, error: compareError } =
      await query.maybeSingle();
    if (compareError) throw compareError;
    // 2. 檢查 compareData 是否有資料
    if (!compareData) {
      console.log(`No compare_data found for apply_no: ${applyNo}`);
      return { compare_data: null, compare_apply: null };
    }

    // 4. 查詢 B_user (僅當 buyer 存在時)
    if (compareData.buyer) {
      const { data: userData, error: userError } = await supabase
        .schema(process.env.DB_SCHEMA)
        .from("b_user")
        .select("fullname, ename")
        .eq("username", compareData.buyer)
        .maybeSingle();

      if (userError) throw userError;

      // 5. 更新 buyer 格式
      if (userData) {
        compareData.buyer = {
          username: compareData.buyer,
          name: `${userData.ename} ${userData.fullname}`,
        };
      }
    }

    if (compareData.sap_sourcer) {
      const { data: buyerData, error: buyerError } = await supabase
        .schema(process.env.DB_SCHEMA)
        .from("sap_sourcer")
        .select("username, name, code")
        .eq("code", compareData.sap_sourcer)
        .maybeSingle();

      if (buyerError) throw buyerError;

      // 5. 更新 buyer 格式
      if (buyerData) {
        compareData.sap_sourcer = buyerData;
      }
    }
    const { compare_apply, ...rest } = compareData;
    // console.log(compare_apply);
    const filteredApply = compare_apply
      .sort((a, b) => a.sort_index - b.sort_index)
      .filter((item) => item.version === rest.version);

    const dataMaps = await loadReferenceData(filteredApply);

    const { factoryMap, vendorMap, brandMap, partsMap, buyerMap, filesMap } =
      dataMaps;

    const now = Date.now();
    const newData = [];
    const chunkSize = 100;
    const chunkedData = chunkArray(filteredApply, chunkSize);

    for (let chunkIndex = 0; chunkIndex < chunkedData.length; chunkIndex++) {
      const chunk = chunkedData[chunkIndex];
      const base = chunkIndex * chunkSize;
      const chunkResult = await Promise.all(
        chunk.map(async (row, index) => {
          const factoryData = factoryMap.get(String(row.factory).trim());
          const vendorData = vendorMap.get(String(row.vendor).trim());
          const brandData = brandMap.get(String(row.brand).trim());
          const partsData = partsMap.get(String(row.partsno).trim());
          const buyerData = buyerMap.get(String(row.buyer).trim());
          const filesData = filesMap.get(String(row.id).trim()) || [];

          const updatedFactoryData = {
            display: `(${factoryData.code})${factoryData.name}`,
            code: factoryData.code,
          };

          const updatedFilesData = filesData.map((file) => {
            const cleaned = file.file_type.replace(".", "");
            return {
              file: { name: file.file_name },
              icon: fileIcons[cleaned] || fileIcons.default, // 根據副檔名選擇圖示
            };
          });
          const result = Object.keys(row).reduce((acc, key) => {
            const rawValue = row[key];
            const keepRawKeys = [
              "is_spot_price",
              "is_unpaid_order_effective",
              "place_of_origin",
              "lme",
              "vendor_quotation_no",
              "control_quantity",
              "annulment_date",
              "effective_remark",
            ];

            if (keepRawKeys.includes(key)) {
              acc[key] = rawValue;
            } else {
              acc[key] = rawValue == null ? "" : String(rawValue); // null 或 undefined 轉成空字串
            }

            return acc;
          }, {});
          // const stringRow = row.map((item) => String(item));
          return {
            id: index + 1 + base,
            apply_no: applyNo,
            Factory: updatedFactoryData,
            Vendor: {
              display: `(${vendorData.code})${vendorData.name}`, // 顯示用
              code: vendorData.code, // 傳輸後端用
            },
            Brand: {
              display: `(${brandData.code})${brandData.name}`, // 顯示用
              code: brandData.code, // 傳輸後端用
            },
            Parts: partsData.name,
            Description: partsData.description,
            OrderSharerate: result.order_share_rate,
            LastPutPrice: result.last_price,
            CurrencyOld: result.last_price_currency,
            UnitPrice: result.unit_price,
            CurrencyNew: result.unit_price_currency,
            Rate: "",
            EffectiveDate: result.effective_date,
            EffectiveRemark: result.effective_remark,
            CostDown: result.cost_down,
            Moq: result.moq,
            Mpq: result.mpq,
            LeadTime: result.lead_time,
            LME: result.lme,
            QuotaDate: result.quota_date,
            AnnulmentDate: result.annulment_date || "",
            ControlQuantity: result.control_quantity,
            VendorQuotationNo: result.vendor_quotation_no,
            Buyer: buyerData,
            AttachFile: updatedFilesData,
            IsSpotPrice: result.is_spot_price ? result.is_spot_price : "N",
            IsUnpaidOrderEffective: result.is_unpaid_order_effective
              ? result.is_unpaid_order_effective
              : "N",
            PlaceOfOrigin: result.place_of_origin,
            type: "AP",
          };
        }),
      );

      newData.push(...chunkResult);
    }

    if (applyNo) {
      comments = await getComments(applyNo, rest.version);
    }
    return { compare_data: rest, compare_apply: newData, comments };
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

async function getDataDraft(draftNo) {
  try {
    // 1. 使用 Promise.all() 讓兩個不相依的查詢並行處理
    let query = supabase
      .schema(process.env.DB_SCHEMA)
      .from("compare_data_draft")
      .select("*, compare_apply_draft(*)")
      .eq("draft_no", draftNo);

    const { data: compareDataDraft, error: compareError } =
      await query.maybeSingle();

    if (compareError) throw compareError;
    // 2. 檢查 compareData 是否有資料
    if (!compareDataDraft) {
      console.log(`No compare_data found for draft_no: ${draftNo}`);
      return { compare_data: null, compare_apply: null };
    }

    // 4. 查詢 B_user (僅當 buyer 存在時)
    if (compareDataDraft.buyer && compareDataDraft.buyer !== "admin") {
      const { data: userData, error: userError } = await supabase
        .schema(process.env.DB_SCHEMA)
        .from("b_user")
        .select("fullname, ename")
        .eq("username", compareDataDraft.buyer)
        .maybeSingle();

      if (userError) throw userError;

      // 5. 更新 buyer 格式
      if (userData) {
        compareDataDraft.buyer = {
          username: compareDataDraft.buyer,
          name: `${userData.ename} ${userData.fullname}`,
        };
      }
    } else {
      compareDataDraft.buyer = { username: "admin", name: "admin" };
    }

    if (compareDataDraft.sap_sourcer) {
      const { data: buyerData, error: buyerError } = await supabase
        .schema(process.env.DB_SCHEMA)
        .from("sap_sourcer")
        .select("username, name, code")
        .eq("code", compareDataDraft.sap_sourcer)
        .maybeSingle();

      if (buyerError) throw buyerError;

      // 5. 更新 buyer 格式
      if (buyerData) {
        compareDataDraft.sap_sourcer = buyerData;
      }
    }
    const { compare_apply_draft, ...rest } = compareDataDraft;
    const filteredApply = compare_apply_draft.filter(
      (item) => item.version === rest.version,
    );

    const dataMaps = await loadReferenceData(filteredApply);
    const { factoryMap, vendorMap, brandMap, partsMap, buyerMap, filesMap } =
      dataMaps;
    const now = Date.now();
    const newData = [];
    const chunkSize = 100;
    const chunkedData = chunkArray(filteredApply, chunkSize);

    for (let chunkIndex = 0; chunkIndex < chunkedData.length; chunkIndex++) {
      const chunk = chunkedData[chunkIndex];
      const base = chunkIndex * chunkSize;
      const chunkResult = await Promise.all(
        chunk.map(async (row, index) => {
          const factoryData = factoryMap.get(String(row.factory).trim());
          const vendorData = vendorMap.get(String(row.vendor).trim());
          const brandData = brandMap.get(String(row.brand).trim());
          const partsData = partsMap.get(String(row.partsno).trim());
          const buyerData = buyerMap.get(String(row.buyer).trim());
          const filesData = filesMap.get(row.id) || [];
          const updatedFactoryData = {
            display: `(${factoryData.code})${factoryData.name}`,
            code: factoryData.code,
          };

          const updatedFilesData = filesData.map((file) => {
            const cleaned = file.file_type.replace(".", "");
            return {
              file: { name: file.file_name },
              icon: fileIcons[cleaned] || fileIcons.default, // 根據副檔名選擇圖示
            };
          });
          const result = Object.keys(row).reduce((acc, key) => {
            const rawValue = row[key];
            const keepRawKeys = [
              "is_spot_price",
              "is_unpaid_order_effective",
              "place_of_origin",
              "lme",
              "vendor_quotation_no",
              "control_quantity",
              "annulment_date",
              "effective_remark",
            ];

            if (keepRawKeys.includes(key)) {
              acc[key] = rawValue;
            } else {
              acc[key] = rawValue == null ? "" : String(rawValue); // null 或 undefined 轉成空字串
            }

            return acc;
          }, {});
          // const stringRow = row.map((item) => String(item));
          return {
            id: index + 1 + base,
            Factory: updatedFactoryData,
            Vendor: {
              display: `(${vendorData.code})${vendorData.name}`, // 顯示用
              code: vendorData.code, // 傳輸後端用
            },
            Brand: {
              display: `(${brandData.code})${brandData.name}`, // 顯示用
              code: brandData.code, // 傳輸後端用
            },
            Parts: partsData.name,
            Description: partsData.description,
            OrderSharerate: result.order_share_rate,
            LastPutPrice: result.last_price,
            CurrencyOld: result.last_price_currency,
            UnitPrice: result.unit_price,
            CurrencyNew: result.unit_price_currency,
            Rate: "",
            EffectiveDate: result.effective_date,
            EffectiveRemark: result.effective_remark,
            CostDown: result.cost_down,
            Moq: result.moq,
            Mpq: result.mpq,
            LeadTime: result.lead_time,
            LME: result.lme,
            QuotaDate: result.quota_date,
            AnnulmentDate: result.annulment_date || "",
            ControlQuantity: result.control_quantity,
            VendorQuotationNo: result.vendor_quotation_no,
            Buyer: buyerData,
            AttachFile: updatedFilesData,
            IsSpotPrice: result.is_spot_price ? result.is_spot_price : "N",
            IsUnpaidOrderEffective: result.is_unpaid_order_effective
              ? result.is_unpaid_order_effective
              : "N",
            PlaceOfOrigin: result.place_of_origin,
            type: "AP",
          };
        }),
      );
      newData.push(...chunkResult);
    }

    return { compare_data_draft: rest, compare_apply_draft: newData };
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

async function loadReferenceData(data) {
  const factoryCodes = new Set();
  const vendorCodes = new Set();
  const brandCodes = new Set();
  const partsNames = new Set();
  const buyerCodes = new Set();
  const applyIds = new Set();
  for (const item of data) {
    if (item.factory) factoryCodes.add(item.factory);
    if (item.vendor) vendorCodes.add(item.vendor);
    if (item.brand) brandCodes.add(item.brand);
    if (item.partsno) partsNames.add(item.partsno);
    if (item.buyer) buyerCodes.add(String(item.buyer));
    if (item.id) applyIds.add(item.id);
  }

  const [factories, vendors, brands, parts, buyers, files] = await Promise.all([
    supabase
      .schema(process.env.DB_SCHEMA)
      .from("factory")
      .select("code, name")
      .in("code", Array.from(factoryCodes)),
    supabase.schema(process.env.DB_SCHEMA),
    supabase.schema(process.env.DB_SCHEMA),
    supabase.schema(process.env.DB_SCHEMA),
    supabase
      .schema(process.env.DB_SCHEMA)
      .from("buyers")
      .select("username, name, factory")
      .in("username", Array.from(buyerCodes)),
    supabase
      .schema(process.env.DB_SCHEMA)
      .from("files")
      .select("item_id, file_name, file_type")
      .in("item_id", Array.from(applyIds)),
  ]);
  const filesMap = new Map();

  (files.data ?? []).forEach((f) => {
    const id = f.item_id;
    if (!filesMap.has(id)) {
      filesMap.set(id, []);
    }
    filesMap.get(id).push(f);
  });

  return {
    factoryMap: new Map((factories.data ?? []).map((f) => [f.code, f])),
    vendorMap: new Map((vendors.data ?? []).map((v) => [v.code, v])),
    brandMap: new Map((brands.data ?? []).map((b) => [b.code, b])),
    partsMap: new Map((parts.data ?? []).map((p) => [p.name, p])),
    buyerMap: new Map((buyers.data ?? []).map((b) => [b.username, b])),
    filesMap,
  };
}

async function getComments(applyNo, version = null) {
  let queryBuilder = supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_comments")
    .select("*")
    .eq("apply_no", applyNo);

  if (version) {
    queryBuilder = queryBuilder.eq("version", version);
  }

  const { data, error } = await queryBuilder;
  // const { data, error } = await supabase
  //   .schema(process.env.DB_SCHEMA)
  //   .from('compare_comments')
  //   .select('*')
  //   .eq('apply_no', applyNo);

  if (error) throw error;

  return data;
}

async function getNextNumbers() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // 轉成2位數
  const prefix = `${year}${month}`; // apply_no 開頭
  const signPrefix = "SG"; // sign_number 開頭
  try {
    const { data: signData, error: signError } = await supabase.schema(
      process.env.DB_SCHEMA,
    );

    const { data: applyData, error: applyError } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("compare_data")
      .select("apply_no")
      .like("apply_no", `${prefix}%`)
      .order("apply_no", { ascending: false })
      .limit(1);

    if (signError || applyError) {
      console.error("查詢錯誤:", signError || applyError);
      return;
    }

    const lastSignNumber =
      signData.length > 0
        ? parseInt(signData[0].sign_number.replace(signPrefix, ""), 10)
        : 0;
    const newSignNumber = `${signPrefix}${String(lastSignNumber + 1)}`;

    const lastApplyNumber =
      applyData.length > 0 ? parseInt(applyData[0].apply_no.slice(6), 10) : 0;
    const newApplyNo = `${prefix}${String(lastApplyNumber + 1).padStart(
      4,
      "0",
    )}`;
    return { newSignNumber, newApplyNo };
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

async function insertCompareData(data, company, retryCount = 10) {
  let attempt = 0;
  while (attempt < retryCount) {
    const { newSignNumber, newApplyNo } = await getNextNumbers();
    const newData = {
      ...data,
      apply_no: newApplyNo,
      sign_number: newSignNumber,
      status: "Sign",
      sap_sourcer: data.sap_sourcer ? data.sap_sourcer : "",
      sap_sourcer_username: data.sap_sourcer_username
        ? data.sap_sourcer_username
        : "",
      version: 1,
      activeId: null,
      company_code: company,
    };

    const { error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("compare_data")
      .insert([newData]);

    if (!error) {
      console.log(`✅ 成功寫入：`, newData);
      return newData;
    } else if (error.code === "23505") {
      // 唯一性違規 (duplicate key error)
      console.warn(`⚠️ 唯一性衝突，重新嘗試 ${attempt + 1}/${retryCount}`);
      attempt++;
    } else {
      console.error(`❌ 其他錯誤:`, error);
      break;
    }
  }
  console.error(`🚨 無法成功寫入資料，請檢查！`);
  return null;
}

async function insertCompareDataVersion(data, company, apply_no, version) {
  const date = moment().format("YYYY-MM-DD");
  const { newSignNumber } = await getNextNumbers();
  const newData = {
    apply_no: apply_no,
    apply_date: date,
    sign_number: newSignNumber,
    status: "resend",
    buyer: data.buyer,
    memo: data.memo,
    sap_sourcer: data.sap_sourcer ? data.sap_sourcer : "",
    sap_sourcer_username: data.sap_sourcer_username
      ? data.sap_sourcer_username
      : "",
    sign_route: data.sign_route,
    version: version,
    activeId: null,
    company_code: company,
  };

  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_data")
    .insert([newData]);

  if (!error) {
    console.log(`✅ 成功寫入：`, newData);
    return newData;
  } else {
    console.error(`❌ 其他錯誤:`, error);
  }
  console.error(`🚨 無法成功寫入資料，請檢查！`);
  return null;
}

async function insertCompareItem(item) {
  const { attachFiles, attachFileNames, attachments, ...newItem } = item;
  let fileNames = [];
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_apply")
    .insert([newItem])
    .select("id");

  if (error || !data || data.length === 0) {
    console.error(`❌ 其他錯誤:`, error);
    throw new Error(`插入失敗: ${JSON.stringify(error)}`); // 拋出錯誤，Promise.all 會中斷
  }

  const itemId = data[0].id;

  if (attachments.length > 0) {
    try {
      const files = await saveFilesToFolder(attachFiles, itemId);
      const fileNamesSave = await saveFilesName(attachFileNames, itemId);
      console.log("✅ 附件儲存成功:", files);
      fileNames = [
        ...files.map((f) => f.file_name),
        ...fileNamesSave.map((f) => f.file_name),
      ];
    } catch (fileError) {
      console.error("❌ 附件儲存失敗:", fileError);
    }
  }

  const updatedItem = {
    ...newItem,
    attachFiles: fileNames, // 將檔案名稱加入到新物件中
  };
  return updatedItem;
}

async function deleteCompareData(apply_no, version = 1) {
  try {
    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("compare_data")
      .delete()
      .eq("apply_no", apply_no)
      .eq("version", version);
    if (error) throw error; // 抛出錯誤
    return true;
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

async function saveFile(file) {
  const uploadPath = process.env.FILE_UPLOAD_PATH || "../data/uploads";

  // 若是相對路徑，將它轉為絕對路徑
  const folderPath = path.isAbsolute(uploadPath)
    ? uploadPath
    : path.join(__dirname, uploadPath);

  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
  const parsed = path.parse(file.originalname);
  const baseName = parsed.name;
  const extension = parsed.ext;

  let fileName = `${baseName}${extension}`;
  let filePath = path.join(folderPath, fileName);
  let counter = 1;

  while (existsSync(filePath)) {
    fileName = `${baseName}(${counter})${extension}`;
    filePath = path.join(folderPath, fileName);
    counter++;
  }

  try {
    // 儲存檔案
    await writeFile(filePath, file.buffer);
    console.log(`✅ 檔案已成功儲存`);
    return { file_name: fileName, file_type: extension };
  } catch (err) {
    console.error("❌ 檔案儲存失敗:", err);
    throw err;
  }
}

async function saveFilesToFolder(files, item_id) {
  const saveTasks = files.map(async (file) => {
    const savedFile = await saveFile(file);
    const newItem = {
      item_id,
      file_name: savedFile.file_name,
      file_type: savedFile.file_type,
    };

    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("files")
      .insert([newItem])
      .select();

    if (error) {
      console.error(`❌ 插入 files 失敗:`, error);
      throw new Error(`插入 files 失敗: ${JSON.stringify(error)}`);
    }

    return savedFile;
  });

  return Promise.all(saveTasks);
}
async function saveFilesName(files, item_id) {
  const saveTasks = files.map(async (file) => {
    const fileType = path.extname(file);
    const newItem = {
      item_id,
      file_name: file,
      file_type: fileType,
    };

    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("files")
      .insert([newItem])
      .select();

    if (error) {
      console.error(`❌ 插入 files 失敗:`, error);
      throw new Error(`插入 files 失敗: ${JSON.stringify(error)}`);
    }

    return { file_name: file, file_type: fileType };
  });

  return Promise.all(saveTasks);
}

async function updatedActiveId(apply_no, activeId, version) {
  // 執行更新
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_data")
    .update({ activeId })
    .eq("apply_no", apply_no)
    .eq("version", version)
    .select();

  if (error) {
    throw new Error(`更新 activeId 失敗: ${JSON.stringify(error)}`);
  }

  return data;
}

async function sendToworkflow(compare_data, compare_apply) {
  console.log("compare_apply數量" + compare_apply.length);
  const url = `${process.env.workflow_URL}workspace/flowservice.asmx`;
  let FieldXml = `<VariableCollection>
    <variable><name>compare_apply_no</name><value>${
      compare_data.apply_no + "_V" + compare_data.version
    }</value></variable>
    <variable><name>compare_type</name><value>${
      compare_data.sign_route
    }</value></variable>
    <variable><name>SignId1</name><value>${
      compare_data.buyer
    }</value></variable>
    <variable><name>buyer</name><value>${compare_data.buyer}</value></variable>
    <variable><name>compare_memo</name><value>${
      compare_data.memo || ""
    }</value></variable>
`;
  if (compare_data.sap_sourcer) {
    FieldXml += `<variable><name>compare_sap_sourcer_username</name><value>${compare_data.sap_sourcer_username}</value></variable>
    <variable><name>SignId2</name><value>${compare_data.sap_sourcer_username}</value></variable>
    <variable><name>compare_sap_sourcer</name><value>${compare_data.sap_sourcer}</value></variable>`;
  }

  FieldXml += `</VariableCollection>`;

  console.log("compare_data.sap_sourcer", compare_data.sap_sourcer);

  FieldXml = `<![CDATA[${FieldXml}]]>`;
  const eflowid =
    process.env.NODE_ENV === "production"
      ? 249
      : process.env.NODE_ENV === "development"
        ? 319
        : 12;
  const data = {
    eflowid: eflowid,
    UserName: compare_data.buyer,
    FieldXml: FieldXml, //  XML 字串
  };

  const xmlns =
    process.env.NODE_ENV === "production"
      ? "http://workflow.planbear-demo.com/"
      : "http://workflow.planbear-demo.com";
  const soapXmlBody = `
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <StartFlow xmlns="${xmlns}">
      <eflowid>${data.eflowid}</eflowid>
      <UserName>${data.UserName}</UserName>
      <FieldXml>${data.FieldXml}</FieldXml>
      <DetailXml></DetailXml>
      <TableName></TableName>
    </StartFlow>
  </soap:Body>
</soap:Envelope>`.trim();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '"http://workflow.planbear-demo.com/StartFlow"', // 確認 workflow WSDL 上定義的 action
      },
      body: soapXmlBody, // 將 data 轉換為 URL 查詢字串
    });
    if (response.ok) {
      // 將回應的 XML 內容轉換為 XMLDocument
      const xmlText = await response.text(); // 取得回應的 XML 內容

      // 使用 Promise 來包裝 xml2js 的解析，讓它支持 async/await
      // 提取 string 屬性 _ 中的值
      const match = xmlText.match(/<StartFlowResult>(.*?)<\/StartFlowResult>/);
      console.log(match);

      const activeid = match ? match[1] : null;

      const addDetailResult = await addDetailToworkflow(
        activeid,
        compare_apply,
      );
      if (addDetailResult.ok) {
        console.log(addDetailResult);
        return activeid;
      } else {
        throw new Error("Add detail to workflow failed: " + addDetailResult);
      }
    } else {
      const errorText = await response.text();
      console.error("workflow 500 Error Response:", errorText);
      console.error("請求失敗:", response.statusText);
    }
  } catch (error) {
    console.error("請求失敗:", error.message);
  }
}

async function addDetailToworkflow(activeid, compare_apply) {
  const url = `${process.env.workflow_URL}workspace/demoservice.asmx`;
  const METHOD = "demoAddDetail";
  const COUNT_PER_BATCH = 1200;
  const chunks = [];
  const sorted = [...compare_apply].sort(
    (a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0),
  );
  for (let i = 0; i < sorted.length; i += COUNT_PER_BATCH) {
    chunks.push(sorted.slice(i, i + COUNT_PER_BATCH));
  }

  const results = [];
  for (const chunk of chunks) {
    let DetailXml = `<items>`;
    chunk.forEach((item) => {
      let itemXml = "<item>";

      itemXml += safeXml(item.factory_display, "factory_display");
      itemXml += safeXml(item.vendor_display, "vendor_display");
      itemXml += safeXml(item.brand_display, "brand_display");
      itemXml += safeXml(item.partsno, "partsno");
      itemXml += safeXml(item.description, "description");
      itemXml += safeXml(item.order_share_rate, "order_share_rate");
      itemXml += safeXml(item.last_price, "last_price");
      itemXml += safeXml(item.last_price_currency, "last_price_currency");
      itemXml += safeXml(item.unit_price, "unit_price");
      itemXml += safeXml(item.unit_price_currency, "unit_price_currency");
      itemXml += safeXml(item.effective_date, "effective_date");
      itemXml += safeXml(item.effective_remark, "effective_remark");
      itemXml += safeXml(item.cost_down, "cost_down");
      itemXml += safeXml(item.moq, "moq");
      itemXml += safeXml(item.mpq, "mpq");
      itemXml += safeXml(item.lead_time, "lead_time");
      itemXml += safeXml(item.lme, "lme");
      itemXml += safeXml(item.quota_date, "quota_date");
      itemXml += safeXml(item.annulment_date, "annulment_date");
      itemXml += safeXml(item.control_quantity, "control_quantity");
      itemXml += safeXml(item.vendor_quotation_no, "vendor_quotation_no");
      itemXml += safeXml(item.is_spot_price, "is_spot_price");
      itemXml += safeXml(item.buyer_username, "buyer_username");
      itemXml += safeXml(
        item.is_unpaid_order_effective,
        "is_unpaid_order_effective",
      );
      itemXml += safeXml(item.place_of_origin, "place_of_origin");
      itemXml += safeXml(item.attachFiles, "attach_files");

      itemXml += "</item>";
      DetailXml += itemXml;
    });
    DetailXml += `</items>`;

    DetailXml = `<![CDATA[${DetailXml}]]>`;
    const data = {
      activeid: activeid, //  XML 字串
      DetailXml: DetailXml, //  XML 字串
      TableName: "workflow_ITEM",
    };

    const xmlns =
      process.env.NODE_ENV === "production"
        ? "http://workflow.planbear-demo.com/"
        : "http://workflow.planbear-demo.com";
    const soapXmlBody = `
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <demoAddDetail xmlns="${xmlns}">
      <activeid>${data.activeid}</activeid>
      <DetailXml>${data.DetailXml}</DetailXml>
      <TableName>${data.TableName}</TableName>
    </demoAddDetail>
  </soap:Body>
</soap:Envelope>`.trim();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: '"http://workflow.planbear-demo.com/demoAddDetail"', // 確認 workflow WSDL 上定義的 action
        },
        body: soapXmlBody, // 將 data 轉換為 URL 查詢字串
      });
      if (response.ok) {
        // 將回應的 XML 內容轉換為 XMLDocument
        const xmlText = await response.text(); // 取得回應的 XML 內容

        // 使用 Promise 來包裝 xml2js 的解析，讓它支持 async/await
        // 提取 string 屬性 _ 中的值
        const match = xmlText.match(
          /<demoAddDetailResult>(.*?)<\/demoAddDetailResult>/,
        );
        console.log(match);

        const respText = match ? match[1] : null;
        results.push(respText);
      } else {
        const errorText = await response.text();
        console.error("workflow 500 Error Response:", errorText);
        console.error("請求失敗:", response.statusText);
        throw response.statusText;
      }
    } catch (error) {
      results.push(null);
      console.error("請求失敗:", error.message);
    }
  }
  return { ok: true, batches: results };
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
      console.log("formUrl:", result);
      return formUrl;
    } else {
      console.error("請求失敗:", response.statusText);
    }
  } catch (error) {
    console.error("請求失敗:", error.message);
  }
}

function safeXml(value, tag) {
  if (value === undefined || value === null) return "";
  const escaped = String(value)
    .replace(/&/g, "&amp;amp;") // HtmlDecode 後 → &amp;
    .replace(/</g, "&amp;lt;") // HtmlDecode 後 → &lt;
    .replace(/>/g, "&amp;gt;") // （> 本來可不轉，保守起見也雙轉）
    .replace(/"/g, "&amp;quot;")
    .replace(/'/g, "&amp;apos;");
  return `<${tag}>${escaped}</${tag}>`;
}

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

function encodeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function updateStatus(apply_no, status, comments = [], version = 1) {
  if (!apply_no) throw new Error("apply_no 不能為空");
  const date = moment().format("YYYY-MM-DD");
  const updateData =
    status === "close" ? { status, end_date: date } : { status };
  let updateQuery = supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_data")
    .update(updateData)
    .eq("apply_no", apply_no)
    .eq("version", version);

  const { error } = await updateQuery;
  if (error) {
    throw new Error(`更新失敗: ${JSON.stringify(error)}`);
  }
  if (Array.isArray(comments) && comments.length > 0) {
    await insertComments(apply_no, comments, version);
  }

  return "SUCCESS";
}

async function insertComments(apply_no, comments, version) {
  // 處理每個 comment 並加上 apply_no
  const commentsWithApplyNo = comments.map((comment) => ({
    ...comment,
    apply_no, // 將 apply_no 加入到每個 comment 中
    version,
  }));

  // 插入到 compare_comments 資料表
  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_comments")
    .upsert(commentsWithApplyNo); // 使用 upsert 可避免重複插入

  if (error) {
    throw new Error(`留言插入失敗: ${error}`);
  }

  return "SUCCESS";
}

async function insertLastPrice(insertedData, chunkSize = 100) {
  const chunks = chunkArray(insertedData, chunkSize);
  const success = [];
  const failed = [];

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("demorfqhistory")
      .insert(chunk)
      .select();

    if (error) {
      console.error("批次插入失敗:", error.message);
      failed.push({ chunk, error });
    } else {
      success.push(...data);
    }
  }

  return { success, failed };
}

async function getSapCode(username) {
  try {
    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("sap_sourcer")
      .select("code")
      .eq("username", username)
      .limit(1);

    if (error) throw error; // 抛出錯誤

    const result = data[0]?.code ? data[0]?.code : null;

    return result;
  } catch (err) {
    console.error("Error fetching SAP code from Supabase:", err);
    throw new Error(err.message);
  }
}

function convertToUSD(price, currency, rate) {
  return price * (rate[currency]?.USD || 1);
}

async function saveDraft(draftNo, title, data) {
  const { error: headerError } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_data_draft")
    .update(title)
    .eq("draft_no", draftNo);

  if (headerError) throw headerError;

  await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_apply_draft")
    .delete()
    .eq("draft_no", draftNo);
  const detailData = data.map((item) => ({
    draft_no: draftNo,
    factory: item.Factory,
    vendor: item.Vendor,
    brand: item.Brand,
    buyer: item.Buyer,
    partsno: item.Parts,
    order_share_rate: item.OrderSharerate,
    last_price: item.LastPutPrice,
    last_price_currency: item.CurrencyOld,
    unit_price: item.UnitPrice,
    unit_price_currency: item.CurrencyNew,
    effective_date: item.EffectiveDate,
    effective_remark: item.EffectiveRemark,
    cost_down: item.CostDown,
    moq: item.Moq,
    mpq: item.Mpq,
    lead_time: item.LeadTime,
    lme: item.LME,
    quota_date: item.QuotaDate,
    annulment_date: item.AnnulmentDate === "" ? null : item.AnnulmentDate,
    control_quantity: item.ControlQuantity,
    vendor_quotation_no: item.VendorQuotationNo,
    is_spot_price: item.IsSpotPrice ? item.IsSpotPrice : "N",
    is_unpaid_order_effective: item.IsUnpaidOrderEffective
      ? item.IsUnpaidOrderEffective
      : "N",
    place_of_origin: item.PlaceOfOrigin,
  }));

  const { error: detailError } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_apply_draft")
    .insert(detailData);

  if (detailError) {
    console.error("❌ 明細儲存失敗:", detailError);
    throw detailError;
  }

  return "SUCCESS";
}

// 路徑GET /api/users：取得所有用戶列表。
router.get("/", async (req, res) => {
  const { applyNo, activeId, version } = req.query;
  const apply_no = applyNo?.split("_")[0];

  await logAction(
    `GET /compare-apply?applyNo=${applyNo}&activeId=${activeId}&version=${version}`,
    "info",
    req,
  );

  try {
    if (isMock) {
      const mockData =
        getStoredMockApply(apply_no, activeId, version) ??
        getMockCompareApplyData(apply_no, activeId, version);
      if (!mockData) {
        return res.status(404).json({
          status: "error",
          message: "No data found.",
          data: [],
        });
      }
      await logAction(
        `GET /compare-apply?applyNo=${applyNo}&activeId=${activeId}&version=${version} (mock)`,
        "info",
        req,
      );
      return res.status(200).json({
        status: "success",
        message: "已找到資料 (mock)",
        data: mockData,
      });
    }

    const data = await getData(apply_no, activeId, version);
    if (!data || data.length === 0) {
      await logUserAction({
        user: req.user,
        action: "view",
        module: "Procurement",
        detail: JSON.stringify({
          status: "error",
          reason: "No data found.",
          apply_no,
          active_id: activeId,
          version,
        }),
        req,
      });
      await logAction(`No data found for compare-apply`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    await logUserAction({
      user: req.user,
      action: "view",
      module: "Procurement",
      detail: JSON.stringify({
        status: "success",
        reason: "已找到資料",
        apply_no,
        active_id: activeId,
        version,
      }),
      req,
    });
    await logAction(
      `Found ${data.compare_apply.length} compare-apply`,
      "info",
      req,
    );

    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data,
    });
  } catch (error) {
    await logUserAction({
      user: req.user,
      action: "view",
      module: "Procurement",
      detail: JSON.stringify({
        status: "error",
        reason: error.message,
        apply_no,
        active_id: activeId,
        version,
      }),
      req,
    });
    await logAction(
      `Unhandled error in GET /compare-apply: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/draft", async (req, res) => {
  try {
    const { draftNo } = req.query;
    if (isMock) {
      const mockData =
        getStoredMockDraft(draftNo) ?? getMockDraftDetailData(draftNo);
      await logAction(
        `GET /compare-apply/draft?draftNo=${draftNo} (mock)`,
        "info",
        req,
      );
      return res.status(200).json({
        status: "success",
        message: "已找到草稿資料 (mock)",
        data: mockData,
      });
    }
    const data = await getDataDraft(draftNo);

    await logAction(`GET /compare-apply/draft?draftNo=${draftNo}`, "info", req);

    res.status(200).json({
      status: "success",
      message: "已找到草稿資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /compare-apply/draft: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/", upload.any(), async (req, res) => {
  const { data, signInfo, title } = req.body;
  const { files } = req;
  const deptSet = new Set(req.user.dept || []);
  let company = "UNKNOWN";

  company = req.user.factory;

  await logAction(`Start creating compare-apply`, "info", req);

  if (isMock) {
    const stored = createStoredMockApply({
      title,
      data,
      company,
      user: req.user,
    });
    await logAction(
      `Mock compare-apply created with apply_no=${stored.compare_data.apply_no}`,
      "info",
      req,
    );
    return res.status(200).json({
      status: "success",
      message: "Compare apply created successfully (mock)",
      data: stored.compare_data.apply_no,
      formUrl: `mock://compare-apply/${stored.compare_data.apply_no}`,
    });
  }

  const newFiles = files.map((file) => {
    const decodedName = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );
    return { ...file, originalname: decodedName };
  });

  const compare_data = await insertCompareData(title, company);

  if (compare_data) {
    const { apply_no } = compare_data;
    await logAction(
      `Inserted compare_data with apply_no=${apply_no}`,
      "info",
      req,
    );
    try {
      const newData = data.map((item, index) => {
        const attachFiles = newFiles.filter((file) => {
          // 檢查檔案的 fieldname 是否符合 data[index][AttachFile] 的格式
          return file.fieldname.startsWith(`data[${index}][AttachFile]`);
        });

        // 轉換為 JSON 字串
        const attachments = [];

        // 3.1 先處理實體檔案
        attachFiles.forEach((file) => {
          attachments.push({
            filename: file.originalname,
            buffer: file.buffer,
            mimetype: file.mimetype,
            isUploaded: true,
          });
        });

        // 將檔案陣列放入對應的資料項目
        return {
          attachFiles,
          attachments,
          attachFileNames: [],
          apply_no: apply_no,
          factory: item.Factory,
          factory_display: item.FactoryDisplay,
          vendor: item.Vendor,
          vendor_display: item.VendorDisplay,
          brand: item.Brand,
          brand_display: item.BrandDisplay,
          partsno: item.Parts,
          description: item.Description,
          order_share_rate: item.OrderSharerate,
          last_price: item.LastPutPrice,
          last_price_currency: item.CurrencyOld,
          unit_price: item.UnitPrice,
          unit_price_currency: item.CurrencyNew,
          effective_date: item.EffectiveDate,
          effective_remark: item.EffectiveRemark,
          cost_down: item.CostDown,
          moq: item.Moq,
          mpq: item.Mpq,
          lead_time: item.LeadTime,
          lme: item.LME === "" ? null : item.LME,
          quota_date: item.QuotaDate,
          annulment_date: item.AnnulmentDate === "" ? null : item.AnnulmentDate,
          control_quantity:
            item.ControlQuantity === "" ? null : item.ControlQuantity,
          vendor_quotation_no:
            item.VendorQuotationNo === "" ? null : item.VendorQuotationNo,
          buyer: item.Buyer,
          buyer_username: item.BuyerUsername,
          is_spot_price: item.IsSpotPrice ? item.IsSpotPrice : "N", // 將 Y/N 換為布林值
          is_unpaid_order_effective: item.IsUnpaidOrderEffective
            ? item.IsUnpaidOrderEffective
            : "N", // 將 Y/N 換為布林值
          place_of_origin: item.PlaceOfOrigin, // 將 PlaceOfOrigin 換為 JSON 字串
          version: 1,
          sort_index: index,
        };
      });
      const limit = pLimit(10);

      const insertedItems = await Promise.all(
        newData.map((item) => limit(() => insertCompareItem(item))),
      );
      if (insertedItems?.length > 0) {
        const activeid = await sendToworkflow(compare_data, insertedItems);

        if (!activeid) {
          await logUserAction({
            user: req.user,
            action: "create",
            module: "Procurement",
            detail: JSON.stringify({
              status: "error",
              reason: "寫入失敗！ activeid 為空值",
            }),
            req,
          });
          await logAction(
            `workflow returned empty activeid for apply_no=${apply_no}`,
            "warn",
          );

          deleteCompareData(apply_no, 1);

          return res
            .status(500)
            .json({ status: "error", message: "寫入失敗！" });
        }

        const formUrl = await getworkflowFormUrl(activeid, compare_data.buyer);
        const updateForm = await updatedActiveId(apply_no, activeid, 1);
        if (!formUrl || !updateForm) {
          deleteCompareData(apply_no, 1);
          await logUserAction({
            user: req.user,
            action: "create",
            module: "Procurement",
            detail: JSON.stringify({
              status: "error",
              reason: "寫入失敗！",
              activeid,
              buyer: compare_data.buyer,
              apply_no,
            }),
            req,
          });
          await logAction(
            `Failed to update workflow formUrl or activeId for ${apply_no}`,
            "error",
          );
          return res
            .status(500)
            .json({ status: "error", message: "寫入失敗！" });
        }
        await logUserAction({
          user: req.user,
          action: "create",
          module: "Procurement",
          detail: JSON.stringify({
            status: "success",
            reason: "所有資料成功寫入！",
            apply_no,
          }),
          req,
        });
        await logAction(
          `compare-apply created successfully with apply_no=${apply_no}`,
          "info",
        );
        res.status(200).json({
          status: "success",
          message: "所有資料成功寫入！",
          data: apply_no,
          formUrl,
        });
      } else {
        deleteCompareData(apply_no, 1);

        await logUserAction({
          user: req.user,
          action: "create",
          module: "Procurement",
          detail: JSON.stringify({
            status: "error",
            reason: "寫入失敗！",
            activeid,
            buyer: compare_data.buyer,
            apply_no,
          }),
          req,
        });
        await logAction(
          `compare-apply created fail with apply_no=${apply_no}`,
          "error",
        );
        res.status(500).json({
          status: "error",
          message: "寫入失敗！",
        });
      }
    } catch (error) {
      await logAction(
        `Exception in POST /compare-apply: ${error.message}`,
        "error",
      );
      return res.status(500).json({
        status: "error",
        message: "資料寫入發生錯誤",
      });
    }
  }
});

router.post("/:apply_no/:version", upload.any(), async (req, res) => {
  const { data, signInfo, title } = req.body;
  const { files } = req;
  const { apply_no, version } = req.params;
  const deptSet = new Set(req.user.dept || []);
  let company = "UNKNOWN";

  company = req.user.factory;

  await logAction(
    `Start creating compare-apply with apply_no=${apply_no} and version=${version}`,
    "info",
    req,
  );
  console.log("Received data:", data);
  if (isMock) {
    const stored = createStoredMockApply({
      applyNo: apply_no,
      version,
      title,
      data,
      company,
      user: req.user,
    });
    await logAction(
      `Mock compare-apply version created with apply_no=${apply_no} and version=${version}`,
      "info",
      req,
    );
    return res.status(200).json({
      status: "success",
      message: "Compare apply version created successfully (mock)",
      data: stored.compare_data.apply_no,
      formUrl: `mock://compare-apply/${apply_no}/V${version}`,
    });
  }

  const newFiles = files.map((file) => {
    const decodedName = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );
    return { ...file, originalname: decodedName };
  });

  const compare_data = await insertCompareDataVersion(
    title,
    company,
    apply_no,
    version,
  );

  if (compare_data) {
    const { apply_no } = compare_data;
    try {
      const newData = data.map((item, index) => {
        const attachFiles = newFiles.filter((file) => {
          // 檢查檔案的 fieldname 是否符合 data[index][AttachFile] 的格式
          return file.fieldname.startsWith(`data[${index}][AttachFile]`);
        });

        const attachments = [];

        // 3.1 先處理實體檔案
        attachFiles.forEach((file) => {
          attachments.push({
            filename: file.originalname,
            buffer: file.buffer,
            mimetype: file.mimetype,
            isUploaded: true,
          });
        });
        if (
          Array.isArray(item.AttachFileName) &&
          item.AttachFileName.length > 0
        ) {
          item.AttachFileName.forEach((file) => {
            attachments.push({
              filename: file,
              buffer: null, // 如果是檔案名稱，則不需要 buffer
              mimetype: null, // 如果是檔案名稱，則不需要 mimetype
              isUploaded: false, // 標記為未上傳
            });
          });
        }

        // 轉換為 JSON 字串
        // 將檔案陣列放入對應的資料項目
        return {
          attachFiles,
          attachments,
          attachFileNames: item.AttachFileName || [],
          apply_no: apply_no,
          factory: item.Factory,
          factory_display: item.FactoryDisplay,
          vendor: item.Vendor,
          vendor_display: item.VendorDisplay,
          brand: item.Brand,
          brand_display: item.BrandDisplay,
          partsno: item.Parts,
          description: item.Description,
          order_share_rate: item.OrderSharerate,
          last_price: item.LastPutPrice,
          last_price_currency: item.CurrencyOld,
          unit_price: item.UnitPrice,
          unit_price_currency: item.CurrencyNew,
          effective_date: item.EffectiveDate,
          effective_remark: item.EffectiveRemark,
          cost_down: item.CostDown,
          moq: item.Moq,
          mpq: item.Mpq,
          lead_time: item.LeadTime,
          lme: item.LME === "" ? null : item.LME,
          quota_date: item.QuotaDate,
          annulment_date: item.AnnulmentDate === "" ? null : item.AnnulmentDate,
          control_quantity:
            item.ControlQuantity === "" ? null : item.ControlQuantity,
          vendor_quotation_no:
            item.VendorQuotationNo === "" ? null : item.VendorQuotationNo,
          buyer: item.Buyer,
          buyer_username: item.BuyerUsername,
          is_spot_price: item.IsSpotPrice ? item.IsSpotPrice : "N", // 將 Y/N 換為布林值
          is_unpaid_order_effective: item.IsUnpaidOrderEffective
            ? item.IsUnpaidOrderEffective
            : "N", // 將 Y/N 換為布林值
          place_of_origin: item.PlaceOfOrigin, // 將 PlaceOfOrigin 換為 JSON 字串
          version: version,
          sort_index: index,
        };
      });
      const limit = pLimit(10);

      const insertedItems = await Promise.all(
        newData.map((item) => limit(() => insertCompareItem(item))),
      );
      if (insertedItems?.length > 0) {
        const activeid = await sendToworkflow(compare_data, insertedItems);
        await logAction(
          `compare-apply created with apply_no=${apply_no} and version=${version}`,
          "info",
          req,
        );

        if (!activeid) {
          await logUserAction({
            user: req.user,
            action: "create",
            module: "Procurement",
            detail: JSON.stringify({
              status: "error",
              reason: "寫入失敗！ activeid 為空值",
            }),
            req,
          });

          await logAction(
            `workflow returned empty activeid for apply_no=${apply_no}`,
            "warn",
          );
          deleteCompareData(apply_no, version);

          return res
            .status(500)
            .json({ status: "error", message: "寫入失敗！" });
        }

        const formUrl = await getworkflowFormUrl(activeid, compare_data.buyer);
        const updateForm = await updatedActiveId(apply_no, activeid, version);
        if (!formUrl || !updateForm) {
          deleteCompareData(apply_no, version);
          await logUserAction({
            user: req.user,
            action: "create",
            module: "Procurement",
            detail: JSON.stringify({
              status: "error",
              reason: "寫入失敗！",
              activeid,
              buyer: compare_data.buyer,
              apply_no,
              version,
            }),
            req,
          });

          await logAction(
            `workflow returned empty formUrl or updateForm for apply_no=${apply_no}`,
            "warn",
          );
          return res
            .status(500)
            .json({ status: "error", message: "寫入失敗！" });
        }

        finishPendingTask(req.user.username, apply_no);

        await logUserAction({
          user: req.user,
          action: "create",
          module: "Procurement",
          detail: JSON.stringify({
            status: "success",
            reason: "所有資料成功寫入！",
            activeid,
            buyer: compare_data.buyer,
            apply_no,
            version,
          }),
          req,
        });

        await logAction(
          `compare-apply created successfully with apply_no=${apply_no} and version=${version}`,
          "info",
          req,
        );
        res.status(200).json({
          status: "success",
          message: "所有資料成功寫入！",
          data: apply_no,
          formUrl,
        });
      } else {
        deleteCompareData(apply_no, version);
        await logUserAction({
          user: req.user,
          action: "create",
          module: "Procurement",
          detail: JSON.stringify({
            status: "error",
            reason: "寫入失敗！",
            buyer: compare_data.buyer,
            apply_no,
            version,
          }),
          req,
        });

        await logAction(
          `compare-apply created fail with apply_no=${apply_no} and version=${version}`,
          "warn",
          req,
        );
        res.status(500).json({
          status: "error",
          message: "寫入失敗！",
        });
      }
    } catch (error) {
      await logAction(
        `Unhandled error in POST /compare-apply: ${error.message}`,
        "error",
        req,
      );
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
});

router.put("/:apply_no/status", async (req, res) => {
  const { apply_no } = req.params;
  const match = apply_no.match(/^(\d+)(?:_V(\d+))?$/);
  const { status, commentJson } = req.body;
  try {
    if (isMock) {
      if (!match) {
        return res.status(400).json({
          status: "error",
          message: "Invalid apply_no format",
        });
      }
      const number = match[1];
      const version = match[2] ? Number(match[2]) : 1;
      const item = mockCompareStore.applications.find(
        ({ compare_data }) =>
          String(compare_data.apply_no) === number &&
          Number(compare_data.version) === version,
      );
      if (!item) {
        return res.status(404).json({
          status: "error",
          message: "No data found.",
        });
      }
      item.compare_data.status = status;
      item.compare_data.updated_at = new Date().toISOString();
      if (commentJson && status !== "destroy") {
        try {
          item.comments = JSON.parse(commentJson.replace(/\|/g, ","));
        } catch {
          item.comments = [];
        }
      }
      return res.status(200).json({
        status: "success",
        message: `${apply_no} status updated successfully (mock)`,
      });
    }

    const fixedJson = commentJson.replace(/\|/g, ",");
    const comments = JSON.parse(fixedJson);
    const user = {
      username: comments[0].username,
      name: comments[0].displayName,
    };
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 月份從 0 開始
    const day = now.getDate();
    await logAction(`PUT /compare-apply/${apply_no}/status`, "info", user);
    if (!match) return { number: null, version: null };

    const number = match[1]; // 基本號碼，例如 2025040001
    const version = match[2] ? parseInt(match[2], 10) : 1;
    const result = await updateStatus(
      number,
      status,
      status != "destroy" ? comments : [],
      version,
    );
    if (result === "SUCCESS") {
      if (status === "close") {
        const { compare_apply, compare_data } = await getData(
          number,
          null,
          version,
        );
        const sapCode = compare_data.sap_sourcer
          ? compare_data.sap_sourcer.code
          : await getSapCode(compare_data.buyer);

        if (!compare_apply) {
          await logUserAction({
            user: user,
            action: "update",
            module: "Procurement",
            detail: JSON.stringify({
              status: "error",
              reason: "找不到資料！",
              apply_no,
              version,
            }),
            req,
          });

          await logAction(
            `compare-apply update fail with apply_no=${apply_no} and version=${version}`,
            "warn",
            req,
          );
          return res.status(500).json({
            status: "error",
            message: "找不到資料！",
          });
        }

        const updateLastPriceData = compare_apply.map((item) => ({
          vendor: item.Vendor.code,
          partno: item.Parts,
          factory: item.Factory.code,
          currency: item.CurrencyNew,
          lastprice: item.UnitPrice,
          pricedate: `${year}-${month}-${day}`,
          moq: item.Moq,
          mpq: item.Mpq,
          leadtime: item.LeadTime,
          brand: item.Brand.code,
          buyer: sapCode,
          quota: item.OrderSharerate,
          quotadate: item.QuotaDate,
          origin: item.PlaceOfOrigin,
          isspotprice: item.IsSpotPrice,
        }));

        const { success, failed } = await insertLastPrice(
          updateLastPriceData.map(({ isspotprice, ...rest }) => rest),
        );
        if (failed.length === 0) {
          await logUserAction({
            user: user,
            action: "update",
            module: "Procurement",
            detail: JSON.stringify({
              status: "success",
              reason: `${apply_no} 狀態更新成功！`,
              new_status: status,
              version,
            }),
            req,
          });

          await logAction(
            `compare-apply update successfully with apply_no=${apply_no} and version=${version}`,
            "info",
            user,
          );
          return res.status(200).json({
            status: "success",
            message: `${apply_no} 狀態更新成功！`,
            data: updateLastPriceData,
          });
        } else {
          await logUserAction({
            user: user,
            action: "update",
            module: "Procurement",
            detail: JSON.stringify({
              status: "error",
              reason: `${apply_no} 狀態更新失敗！`,
              new_status: status,
              version,
              failed: failed.map((f) => ({
                error: f.error.message,
                rows: f.chunk.length,
              })),
            }),
            req,
          });

          await logAction(
            `compare-apply update fail with apply_no=${apply_no} and version=${version}`,
            "warn",
            user,
          );
          return res.status(500).json({
            status: "error",
            message: `${apply_no} 狀態更新失敗！`,
          });
        }
      }
      await logUserAction({
        user: user,
        action: "update",
        module: "Procurement",
        detail: JSON.stringify({
          status: "success",
          reason: `${apply_no} 狀態更新成功！`,
          new_status: status,
          version,
        }),
        req,
      });

      await logAction(
        `compare-apply update successfully with apply_no=${apply_no} and version=${version}`,
        "info",
        user,
      );

      if (status === "reject") {
        const memo = comments[comments.length - 1].comment;
        addPendingTasks(
          user.username,
          "Vendor Compare Price",
          number,
          "詢比價單退件",
          memo,
          `Procurement/Application/${apply_no}`,
        );
      } else if (status === "destroy") {
        const pureNo = apply_no.split("_")[0];
        finishPendingTask(user.username, pureNo);
      }
      // 不為 close 狀態
      return res.status(200).json({
        status: "success",
        message: `${apply_no} 狀態更新成功！`,
      });
    }
    await logUserAction({
      user: user,
      action: "update",
      module: "Procurement",
      detail: JSON.stringify({
        status: "error",
        reason: `${apply_no} 狀態更新失敗！`,
        version,
      }),
      req,
    });

    await logAction(
      `compare-apply update fail with apply_no=${apply_no} and version=${version}`,
      "warn",
      user,
    );
    // result !== 'SUCCESS'
    return res.status(500).json({
      status: "error",
      message: `${apply_no} 狀態更新失敗！`,
    });
  } catch (err) {
    console.error("處理 commentJson 時出錯:", err);
    return res
      .status(400)
      .json({ status: "error", message: "Invalid commentJson format" });
  }
});

router.put("/draft/:draftNo", async (req, res) => {
  try {
    const { draftNo } = req.params;
    const { data, title } = req.body;

    if (isMock) {
      const { created } = upsertStoredMockDraft({
        draftNo,
        title,
        data,
        user: req.user,
      });

      await logAction(
        `${created ? "Created" : "Updated"} mock draft ${draftNo}`,
        "info",
        req,
      );

      return res.status(200).json({
        status: "success",
        message: created
          ? "Draft created successfully (mock)"
          : "Draft saved successfully (mock)",
      });
    }

    const result = await saveDraft(draftNo, title, data);

    await logAction(`PUT /compare-apply/draft/${draftNo}`, "info", req);

    res.status(200).json({
      status: "success",
      message: "草稿更新成功",
    });
  } catch (error) {
    const { draftNo } = req.params;

    await logAction(
      `Unhandled error in PUT /compare-apply/draft/${draftNo}: ${error.message}`,
      "warn",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

export default router;
