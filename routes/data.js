import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
import fs from "fs";
const upload = multer();
import supabase from "../configs/supabase.js";
import pLimit from "p-limit";
import { logUserAction, logAction } from "../utils/useLogger.js";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
const isMock = process.env.USE_MOCK === "true";

/**
 * @swagger
 * /data/import-excel:
 *   post:
 *     summary:  Import data from Excel
 *     tags:
 *       - VENDOR Compare Price
 *     description: Imports data from an Excel file.
 *     requestBody:
 *       description: Upload data from an Excel file
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: array
 *               example: ['VV00',   '0003992U','MT0955', '153K1E01030-H00',20,       0.0141,'TWD',    45295,20,       20,2,        2,2,        45295,45295,    20,20,       'T34','Y',      'Y','TW台灣']
 *     responses:
 *       200:
 *         description: Successfully imported data from Excel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "已撈取資料"
 *                 data:
 *                   type: array
 *                   items:
 *                    type: object
 *                    properties:
 *                      id:
 *                        type: number
 *                        example: 1742189251504
 *                      Factory:
 *                        type: object
 *                        properties:
 *                          display:
 *                            type: string
 *                            example: '飛宏(東莞)電子有限公司'
 *                          code:
 *                            type: string
 *                            example: 'CC00'
 *                      Vendor:
 *                        type: object
 *                        properties:
 *                          display:
 *                            type: string
 *                            example: '(0001590)晟鈦股份有限公司'
 *                          code:
 *                            type: string
 *                            example: '0001590'
 *                      Brand:
 *                        type: object
 *                        properties:
 *                          display:
 *                            type: string
 *                            example: '(MA0065)長盛'
 *                          code:
 *                            type: string
 *                            example: 'MA0065'
 *                      Parts:
 *                        type: string
 *                        example: '102M1H472RS-R00'
 *                      Description:
 *                        type: string
 *                        example: 'CC 4700PF 50V +-20% Z5U TS5'
 *                      OrderSharerate:
 *                        type: string
 *                        example: '20'
 *                      LastPutPrice:
 *                        type: string
 *                        example: "0"
 *                      CurrencyOld:
 *                        type: string
 *                        example: 'TWD'
 *                      Rate:
 *                        type: string
 *                        example: ""
 *                      EffectiveDate:
 *                        type: date-time
 *                        example: '2024-01-06'
 *                      EffectiveRemark:
 *                        type: string
 *                        example: '20'
 *                      CostDown:
 *                        type: string
 *                        example: ""
 *                      Moq:
 *                        type: string
 *                        example: '20'
 *                      Mpq:
 *                        type: string
 *                        example: '2'
 *                      LeadTime:
 *                        type: string
 *                        example: '2'
 *                      LME:
 *                        type: string
 *                        example: "2"
 *                      QuotaDate:
 *                        type: date-time
 *                        example: '2024-01-11'
 *                      AnnulmentDate:
 *                        type: date-time
 *                        example: '2024-01-11'
 *                      ControlQuantity:
 *                        type: string
 *                        example: "20"
 *                      VendorQuotationNo:
 *                        type: string
 *                        example: "20"
 *                      Buyer:
 *                        type: object
 *                        properties:
 *                          username:
 *                            type: string
 *                            example: '7147'
 *                          name:
 *                            type: string
 *                            example: '林俊宏'
 *                          code:
 *                            type: string
 *                            example: 'T03'
 *                      AttachFile:
 *                        type: array
 *                        example: []
 *                      IsSpotPrice:
 *                        type: string
 *                        example: "Y"
 *                      IsUnpaidOrderEffective:
 *                        type: string
 *                        example: "Y"
 *                      PlaceOfOrigin:
 *                        type: array
 *                        example: ["TW 台灣", "UK 英國"]
 *                      type:
 *                        type: string
 *                        example: "AP"
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

  // 預設f
  default: "/img/other.png",
};

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
      name: "山姆電子股份有限公司(美國)",
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
      name: "Buyer 7125",
      username: "7125",
      factory: "TPE",
    },
    {
      code: "C02",
      name: "Buyer 7126",
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

const mapBy = (rows, key) => new Map(rows.map((row) => [row[key], row]));

const getMockLastPriceMap = () => {
  const map = new Map();

  for (const row of mockReferenceData.lastPrices) {
    const key = `${row.factory}|${row.brand}|${row.vendor}|${row.partno}`;
    map.set(key, {
      currency: row.currency,
      lastprice: row.lastprice,
    });
  }

  return map;
};

const getMockReferenceMaps = () => ({
  factoryMap: mapBy(mockReferenceData.factories, "code"),
  vendorMap: mapBy(mockReferenceData.vendors, "code"),
  brandMap: mapBy(mockReferenceData.brands, "code"),
  partsMap: mapBy(mockReferenceData.parts, "name"),
  buyerMap: mapBy(mockReferenceData.buyers, "username"),
});

const getMapValue = (map, value) => {
  const rawValue = String(value ?? "").trim();
  return map.get(rawValue) || map.get(rawValue.toUpperCase());
};

const loadOriginCountries = async () => {
  if (isMock) return mockReferenceData.countries;

  const { data: countries } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("origin_country")
    .select("code");

  return countries ?? [];
};

async function loadReferenceData(data) {
  if (isMock) return getMockReferenceMaps();

  const normalize = (v) =>
    (v ?? "")
      .toString()
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();

  const normalizeCode = (v) => normalize(v).toUpperCase();

  const factoryCodes = [...new Set(data.map((row) => normalizeCode(row[0])))];
  const vendorCodes = [...new Set(data.map((row) => normalizeCode(row[1])))];
  const brandCodes = [...new Set(data.map((row) => normalizeCode(row[2])))];
  const partsNames = [...new Set(data.map((row) => normalizeCode(row[3])))];
  const buyerCodes = [...new Set(data.map((row) => normalizeCode(row[17])))];
  // 料號權限控管
  // const params = {
  //   p_dept_csv: user.dept[0], // 例如 '60229'
  //   p_factory: company, // 例如 'Zerova'
  //   p_names: partsNames, // 例如 'user123'
  // };
  // const { data: visibleList, error } = await supabase
  //   .schema(process.env.DB_SCHEMA)
  // if (error) throw error; // 抛出錯誤

  // const visibleSet = new Set(visibleList.map((r) => r.name));
  // const allowedNames = partsNames.filter((n) => visibleSet.has(n));
  // console.log(partsNames);
  const [factories, vendors, brands, parts, buyers] = await Promise.all([
    supabase
      .schema(process.env.DB_SCHEMA)
      .from("factory")
      .select()
      .in("code", factoryCodes),
    supabase.schema(process.env.DB_SCHEMA),
    supabase.schema(process.env.DB_SCHEMA),
    supabase.schema(process.env.DB_SCHEMA),
    supabase
      .schema(process.env.DB_SCHEMA)
      .from("buyers")
      .select()
      .in("username", buyerCodes),
  ]);
  return {
    factoryMap: new Map((factories.data ?? []).map((f) => [f.code, f])),
    vendorMap: new Map((vendors.data ?? []).map((v) => [v.code, v])),
    brandMap: new Map((brands.data ?? []).map((b) => [b.code, b])),
    partsMap: new Map((parts.data ?? []).map((p) => [p.name, p])),
    buyerMap: new Map((buyers.data ?? []).map((b) => [b.username, b])),
  };
}

async function loadLastPriceMap(data) {
  if (isMock) return getMockLastPriceMap();

  const keysArr = Array.from(
    new Set(data.map((row) => `${row[0]}|${row[2]}|${row[1]}|${row[3]}`)),
  ).map((s) => {
    const [factory, brand, vendor, part] = s
      .split("|")
      .map((v) => (v ?? "").toString().trim().toUpperCase());
    return [factory, brand, vendor, part];
  });

  const { data: rows, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("last_prices")
    .select()
    .in("factory, brand, vendor, partno", keysArr);
  console.log(rows);
  if (error) throw error;

  const map = new Map();
  for (const r of rows ?? []) {
    const k = `${r.factory}|${r.brand}|${r.vendor}|${r.partno}`;
    map.set(k, { currency: r.currency ?? "", lastprice: r.lastprice ?? "0" });
  }
  return map;
}

async function transformRow(row, index, maps, priceMap, now, errors) {
  const { factoryMap, vendorMap, brandMap, partsMap, buyerMap } = maps;
  const countries = await loadOriginCountries();
  const factoryData = getMapValue(factoryMap, row[0]);
  const vendorData = getMapValue(vendorMap, row[1]);
  const brandData = getMapValue(brandMap, row[2]);
  const partsData = getMapValue(partsMap, row[3]);
  const buyerData = getMapValue(buyerMap, row[17]);
  const priceKey = `${String(row[0]).trim()}|${String(row[2]).trim()}|${String(
    row[1],
  ).trim()}|${String(row[3]).trim()}`;
  const lastPriceData = priceMap.get(priceKey);
  if (!factoryData) errors.push(`Row ${index + 1}: Factory data not found.`);
  if (!vendorData) errors.push(`Row ${index + 1}: Vendor data not found.`);
  if (!brandData) errors.push(`Row ${index + 1}: Brand data not found.`);
  if (!partsData) errors.push(`Row ${index + 1}: Parts data not found.`);
  if (!buyerData) errors.push(`Row ${index + 1}: Buyer data not found.`);

  if (!factoryData || !vendorData || !brandData || !partsData || !buyerData) {
    return null;
  }

  if (Number(row[4]) > 100 || Number(row[4]) < 0) {
    errors.push(
      `Row ${index + 1}: Order share rate must be between 0 and 100.`,
    );
    return null;
  }

  if (row[14]) {
    const effective = new Date(excelDateToJSDate(row[7]));
    const annulment = new Date(excelDateToJSDate(row[14]));
    if (effective > annulment) {
      errors.push(
        `Row ${index + 1}: Effective date cannot be after annulment date.`,
      );
      return null;
    }
  }

  const { currency = "", lastprice = "0" } = lastPriceData || {};
  const stringRow = Array.from(row, (i) => {
    if (typeof i === "number") {
      return parseFloat(i.toFixed(5)).toString();
    }
    return i == null ? "" : String(i);
  });
  const placeOfOriginArray = stringRow[20].split(", ").map((i) => i.trim());

  const validCodes = new Set(countries.map((c) => c.code));

  const results = placeOfOriginArray.map((value) => {
    const code = getCountryCode(value);
    if (!code || !validCodes.has(code)) {
      errors.push(
        `Row ${index + 1}: Place of Origin "${value}" has invalid or missing country code.`,
      );
      return null;
    }
    return value;
  });

  return {
    id: index + 1,
    Factory: {
      display: `(${factoryData.code.trim()})${factoryData.name.trim()}`,
      code: factoryData.code.trim(),
    },
    Vendor: {
      display: `(${vendorData.code.trim()})${vendorData.name.trim()}`,
      code: vendorData.code.trim(),
    },
    Brand: {
      display: `(${brandData.code.trim()})${brandData.name.trim()}`,
      code: brandData.code.trim(),
    },
    Parts: partsData.name.trim(),
    Description: partsData.description.trim(),
    OrderSharerate: stringRow[4].trim(),
    LastPutPrice: lastprice,
    CurrencyOld: currency.trim() || vendorData.currency.trim(),
    UnitPrice: stringRow[5].trim(),
    CurrencyNew: currency.trim() || vendorData.currency.trim(),
    Rate: "",
    EffectiveDate: excelDateToJSDate(row[7]),
    EffectiveRemark: stringRow[8].trim(),
    CostDown: "",
    Moq: stringRow[9].trim(),
    Mpq: stringRow[10].trim(),
    LeadTime: stringRow[11].trim(),
    LME: stringRow[12].trim(),
    QuotaDate: excelDateToJSDate(row[13]),
    AnnulmentDate: row[14] ? excelDateToJSDate(row[14]) : "",
    ControlQuantity: stringRow[15].trim(),
    VendorQuotationNo: stringRow[16].trim(),
    Buyer: {
      username: buyerData.username.trim(),
      name: buyerData.name.trim(),
      factory: buyerData.factory.trim(),
    },
    AttachFile: [],
    IsSpotPrice: stringRow[18].trim(),
    IsUnpaidOrderEffective: stringRow[19].trim(),
    PlaceOfOrigin: results,
    type: "AP",
  };
}

const getCountryCode = (value) => {
  const match = value.trim().match(/^([A-Za-z]{2})\b/);
  return match ? match[1].toUpperCase() : null;
};

async function getLastPrice(factoryCode, brandCode, vendorCode, parts) {
  try {
    let sapSourcer = supabase
      .schema(process.env.DB_SCHEMA)
      .from("demorfqhistory")
      .select("currency, lastprice")
      .eq("factory", factoryCode)
      .eq("brand", brandCode)
      .eq("vendor", vendorCode)
      .eq("partno", parts)
      .order("pricedate", { ascending: false }) // 按照 pricedate 降序排列
      .limit(1)
      .maybeSingle();

    const { data, error } = await sapSourcer;
    if (error) throw error; // 抛出錯誤
    return data;
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

const excelDateToJSDate = (serial) => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000).toISOString().split("T")[0];
};

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const processData = async (data) => {
  const errors = [];
  const now = Date.now();
  const maps = await loadReferenceData(data);
  const priceMap = await loadLastPriceMap(data);
  const chunkedData = chunkArray(data, 100);
  const newData = [];
  const limit = pLimit(10);
  const seenKeys = new Map();
  const duplicateIndexes = [];
  let rowIndex = 0;
  for (const chunk of chunkedData) {
    const result = await Promise.all(
      chunk.map((row, idx) =>
        limit(() => transformRow(row, rowIndex++, maps, priceMap, now, errors)),
      ),
    );
    newData.push(...result);
  }

  // 檢查重複的行
  newData.forEach((row, idx) => {
    if (!row) return;

    const key = `${row.Factory.code}|${row.Parts}|${row.Vendor.code}|${row.Brand.code}`;

    if (seenKeys.has(key)) {
      const prevIndex = seenKeys.get(key);
      duplicateIndexes.push(
        `Row ${prevIndex + 1} & Row ${idx + 1}: duplicated items`,
      );
    } else {
      seenKeys.set(key, idx);
    }
  });

  if (duplicateIndexes.length > 0) {
    return `Duplicate items found:<br>${duplicateIndexes.join("<br>")}`;
  }

  if (errors.length > 0) {
    throw new Error(errors.map((e) => `${e}<br />`).join(""));
  }
  return newData.filter(Boolean);
};

const isXlsx = (buf) => buf[0] === 0x50 && buf[1] === 0x4b; // 'PK'
const isXls = (buf) =>
  buf[0] === 0xd0 &&
  buf[1] === 0xcf &&
  buf[2] === 0x11 &&
  buf[3] === 0xe0 &&
  buf[4] === 0xa1 &&
  buf[5] === 0xb1 &&
  buf[6] === 0x1a &&
  buf[7] === 0xe1;

const parseExcelFile = async (file) => {
  const buf = file.buffer;
  let loadBuf;

  if (isXls(buf)) {
    // 先把 .xls 讀進來並轉成 .xlsx buffer
    const wbLegacy = XLSX.read(buf, { type: "buffer" });
    loadBuf = XLSX.write(wbLegacy, { bookType: "xlsx", type: "buffer" });
  } else if (isXlsx(buf)) {
    // .xlsx 直接給 exceljs
    loadBuf = buf;
  } else {
    throw new Error("Unsupported file type: only .xls/.xlsx");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(loadBuf);
  const worksheet = workbook.worksheets[0];

  const errors = [];
  const validRows = [];
  worksheet.eachRow((row, rowIndex) => {
    const values = row.values.slice(1); // 移除 index 0
    if (rowIndex === 0) return; // skip header
    if (
      values.every((_, i) => {
        const cell = row.getCell(i + 1);
        const val = getCellValue(cell);
        return val === null || val === "";
      })
    ) {
      return;
    }

    const processedValues = values.map((_, i) =>
      getCellValue(row.getCell(i + 1)),
    );

    if (
      processedValues.length !== 21 ||
      processedValues.some((val) => val === null || val === "")
    ) {
      errors.push(`Row ${rowIndex + 1}: Columns missing or empty`);
      return;
    }

    validRows.push(processedValues);
  });
  return errors.length ? errors.join("<br>") : cleanExcelData(validRows);
};

function getCellValue(cell) {
  if (!cell) return null;
  const value = cell.value;
  if (value && typeof value === "object" && "result" in value) {
    // 是公式儲存格，取結果值
    return value.result;
  }

  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((rt) => rt.text).join("");
  }
  return value; // 一般值或其他物件
}

const cleanExcelData = (rows) => {
  if (!Array.isArray(rows) || rows.length <= 1) return [];

  return rows.slice(1).map((row) =>
    row.map((cell) => {
      if (cell instanceof Date) {
        const baseDate = new Date(Date.UTC(1899, 11, 30)); // Excel 起始日
        const targetDate = new Date(cell); // 可接受 Date 或 ISO 字串
        const diffTime = targetDate - baseDate;
        return Math.floor(diffTime / (1000 * 60 * 60 * 24)); // 轉為 timestamp（秒），若要毫秒就不用除 1000
      }
      return cell;
    }),
  );
};

router.get("/files", async (req, res) => {
  const filename = req.query.filename;
  if (!filename) {
    return res
      .status(400)
      .json({ status: "error", message: "缺少 filename 參數" });
  }

  const folderPath =
    process.env.FILE_UPLOAD_PATH || path.join(__dirname, "../data/uploads");
  const filePath = path.join(folderPath, filename);

  // if (!fs.existsSync(filePath)) {
  //   return res.status(404).json({ status: 'error', message: '檔案不存在' });
  // }

  await logAction(`GET /data/files`, "info", req);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(filename)}"`,
  );
  res.sendFile(filePath);
});

router.post("/import-excel", upload.single("file"), async (req, res) => {
  await logAction(`POST /data/import-excel`, "info", req);
  try {
    const file = await parseExcelFile(req.file);

    if (typeof file === "string") {
      await logUserAction({
        user: req.user,
        action: "import",
        module: "Procurement",
        detail: JSON.stringify({
          status: "error",
          reason: file,
          file_name: req.file?.originalname || "unknown",
          file_size: req.file?.size || 0,
        }),
        req,
      });

      return res.status(400).json({
        status: "error",
        message: file,
      });
    }

    const data = await processData(file, req.user);
    if (typeof data === "string") {
      await logUserAction({
        user: req.user,
        action: "import",
        module: "Procurement",
        detail: JSON.stringify({
          status: "error",
          reason: data,
          file_name: req.file?.originalname || "mock-import-excel.xlsx",
          file_size: req.file?.size || 0,
        }),
        req,
      });

      logAction(
        `Unhandled error in POST /data/import-excel: ${data}`,
        "error",
        req,
      );
      return res.status(400).json({
        status: "error",
        message: data,
      });
    }

    await logUserAction({
      user: req.user,
      action: "import",
      module: "Procurement",
      detail: JSON.stringify({
        status: "success",
        reason: "成功匯入 Excel",
        file_name: req.file?.originalname || "mock-import-excel.xlsx",
        file_size: req.file?.size || 0,
        record_count: data.length,
      }),
      req,
    });

    logAction(
      `Successfully imported data from Excel: ${
        req.file?.originalname || "mock-import-excel.xlsx"
      }`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: isMock
        ? "Imported Excel successfully (mock)"
        : "Imported Excel successfully",
      data,
    });
  } catch (error) {
    await logUserAction({
      user: req.user,
      action: "import",
      module: "Procurement",
      detail: JSON.stringify({
        status: "error",
        reason: error.message,
        file_name: req.file?.originalname || "unknown",
      }),
      req,
    });

    await logAction(
      `Unhandled error in POST /data/import-excel: ${error.message}`,
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
