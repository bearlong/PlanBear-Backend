import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../configs/supabase.js";
import { logAction, logUserAction } from "#utils/useLogger.js";
import {
  cloneMockCompareData,
  mockCompareStore,
  nextMockDraftNo,
} from "../configs/mockCompareStore.js";
const isMock = process.env.USE_MOCK === "true";

const parseMockValue = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeMockBuyer = (buyer, fallbackUsername, user) => {
  if (buyer && typeof buyer === "object") return buyer;
  const username = buyer || fallbackUsername || user?.username || "mock";
  return {
    username,
    name: user?.username === username ? (user?.name ?? username) : username,
  };
};

const normalizeMockSourcer = (sapSourcer, sapSourcerUsername) => {
  if (sapSourcer && typeof sapSourcer === "object") return sapSourcer;
  if (!sapSourcer) return null;
  return {
    code: sapSourcer,
    name: sapSourcer,
    username: sapSourcerUsername ?? sapSourcer,
  };
};

/**
 * @swagger
 * /compare-data:
 *   get:
 *     summary: Get compare-data info
 *     tags:
 *       - VENDOR Compare Price
 *     description: Retrieve the column headers for the VENDOR Compare Price form, with optional filters for buyer, status, apply_no, dateStart, dateEnd, or partsno. Returns data in JSON format.
 *     parameters:
 *       - in: query
 *         name: buyer
 *         description: Buyer code used to retrieve the column headers.
 *         required: true
 *         schema:
 *           type: string
 *           example: "8892"
 *       - in: query
 *         name: status
 *         description: Filter the column headers by status.
 *         required: false
 *         schema:
 *           type: string
 *           example: "close"
 *       - in: query
 *         name: apply_no
 *         description: Filter the column headers by apply number.
 *         required: false
 *         schema:
 *           type: string
 *           example: "2025020001"
 *       - in: query
 *         name: dateStart
 *         description: Filter the column headers by the start date of the application period.
 *         required: false
 *         schema:
 *           type: date-time
 *           example: "2025-03-13"
 *       - in: query
 *         name: dateEnd
 *         description: Filter the column headers by the end date of the application period.
 *         required: false
 *         schema:
 *           type: date-time
 *           example: "2025-03-28"
 *       - in: query
 *         name: partsno
 *         description: Filter the column headers by part number.
 *         required: false
 *         schema:
 *           type: string
 *           example: "84A00800048"
 *     responses:
 *       200:
 *         description: Successfully retrieved the latest quotation
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
 *                      sign_number:
 *                        type: string
 *                        example: "SG2"
 *                      apply_no:
 *                        type: string
 *                        example: "2025020002"
 *                      buyer:
 *                        type: string
 *                        example: "Bear_Shen 沈正龍"
 *                      apply_date:
 *                        type: date-time
 *                        example: "2025-02-27"
 *                      sap_sourcer:
 *                        type: string
 *                        example: "T04"
 *                      status:
 *                        type: string
 *                        example: "Sign"
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

const getMockDraftData = (buyer, status) => {
  return cloneMockCompareData(
    mockCompareStore.drafts
      .map((item) => item.compare_data_draft)
      .filter((item) => {
        const buyerUsername = item.buyer?.username ?? item.buyer;
        if (buyer && buyerUsername !== buyer) return false;
        if (status && item.status !== status) return false;
        return true;
      }),
  );
};

const getMockData = (searchArr) => {
  const {
    status,
    apply_no,
    dateStart,
    dateEnd,
    partsno,
    company,
    searchUsername,
  } = searchArr;
  const normalize = (value) => value?.toString().trim().toUpperCase() ?? "";

  return mockCompareStore.applications
    .map(({ compare_data, compare_apply }) => ({
      sign_number: compare_data.sign_number,
      apply_no: compare_data.apply_no,
      buyer: compare_data.buyer?.name ?? compare_data.buyer,
      apply_date: compare_data.apply_date,
      sap_sourcer:
        compare_data.sap_sourcer?.code ?? compare_data.sap_sourcer ?? "",
      sap_sourcer_username: compare_data.sap_sourcer?.username ?? "",
      status: compare_data.status,
      version: compare_data.version,
      company_code: compare_data.company_code,
      partsno: compare_apply.map((item) => item.Parts).filter(Boolean),
    }))
    .filter((item) => {
      if (apply_no && !normalize(item.apply_no).includes(normalize(apply_no))) {
        return false;
      }
      if (dateStart && new Date(item.apply_date) < new Date(dateStart)) {
        return false;
      }
      if (dateEnd && new Date(item.apply_date) > new Date(dateEnd)) {
        return false;
      }
      if (
        partsno &&
        !item.partsno.some((part) =>
          normalize(part).includes(normalize(partsno)),
        )
      ) {
        return false;
      }
      if (company && item.company_code !== company) return false;
      if (
        status &&
        status !== "submitted" &&
        normalize(item.status) !== normalize(status)
      ) {
        return false;
      }
      if (searchUsername) {
        const normalizedSearch = normalize(searchUsername);
        const buyerMatch = normalize(item.buyer).includes(normalizedSearch);
        const sapSourcerMatch =
          normalize(item.sap_sourcer).includes(normalizedSearch) ||
          normalize(item.sap_sourcer_username).includes(normalizedSearch);
        if (!buyerMatch && !sapSourcerMatch) {
          return false;
        }
      }
      return true;
    })
    .map(({ partsno: _partsno, ...item }) => item);
};

async function getData(query, status = "submitted", search = {}, page = 1) {
  const limit = 50;
  const offset = (page - 1) * limit;
  const { apply_no, dateStart, dateEnd, partsno, company, searchUsername } =
    search;
  try {
    let queryBuilder = supabase
      .schema(process.env.DB_SCHEMA)
      .from("compare_data")
      .select(
        "sign_number, apply_no, buyer, apply_date, sap_sourcer, status, version, company_code",
        { count: "exact" },
      );

    if (company) {
      queryBuilder = queryBuilder.eq("company_code", company);
    }

    if (status) {
      if (status === "submitted") {
        queryBuilder = queryBuilder.neq("status", "draft"); // 排除 draft
      } else {
        queryBuilder = queryBuilder.eq("status", status);
      }
    }

    if (apply_no) {
      queryBuilder = queryBuilder.ilike(
        "apply_no",
        `%${apply_no.trim().toUpperCase()}%`,
      );
    }

    if (dateStart) {
      queryBuilder = queryBuilder.gte("apply_date", dateStart);
    }

    // 如果 `dateEnd` 有值，則篩選 `apply_date <= dateEnd`
    if (dateEnd) {
      queryBuilder = queryBuilder.lte("apply_date", dateEnd);
    }

    if (searchUsername) {
      queryBuilder = queryBuilder.or(
        `buyer.eq.${searchUsername
          .trim()
          .toUpperCase()},sap_sourcer_username.eq.${searchUsername
          .trim()
          .toUpperCase()}`,
      );
    }

    if (partsno) {
      const { data: applyData, error: applyError } = await supabase
        .schema(process.env.DB_SCHEMA)
        .from("compare_apply")
        .select("apply_no")
        .ilike("partsno", `%${partsno.trim().toUpperCase()}%`);

      if (applyError) {
        console.error("Error fetching apply_no:", applyError);
      }

      const applyNos = applyData.map((item) => item.apply_no);

      queryBuilder = queryBuilder.in("apply_no", applyNos);
    }
    queryBuilder = queryBuilder
      .range(offset, offset + limit - 1)
      .order("apply_no", { ascending: true });
    const { data, error, count } = await queryBuilder;
    const totalPages = Math.ceil(count / limit);
    if (error) throw error; // 抛出錯誤

    const userMap = await getUserFullname(data);

    const normalize = (v) =>
      (v ?? "")
        .toString()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim();

    if (userMap) {
      // 遍歷 compare_data，為每個 item 加上 buyer 欄位
      data.forEach((item) => {
        const key = normalize(item.buyer);
        const display = userMap.get(key);
        if (display) item.buyer = display;
      });
    }
    const filteredData = data.map((item) => {
      const { ...rest } = item; // 解構賦值，移除 compare_apply
      return rest; // 返回沒有 compare_apply 的對象
    });

    return { filteredData, totalPages };
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

async function getUserFullname(data) {
  try {
    const normalize = (v) =>
      (v ?? "")
        .toString()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim();

    const uniqueBuyers = [...new Set(data.map((i) => normalize(i.buyer)))];
    const { data: userData, error: userError } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("b_user")
      .select("username, fullname, ename")
      .in("username", uniqueBuyers);
    if (userError) throw userError; // 抛出錯誤

    const userMap = new Map(
      (userData ?? []).map((u) => [
        u.username,
        `${u.ename ?? ""} ${u.fullname ?? ""}`.trim(),
      ]),
    );

    return userMap;
  } catch (err) {}
}

async function getDataDraft(buyer, status) {
  console.log(buyer, status);
  try {
    let queryBuilder = supabase
      .schema(process.env.DB_SCHEMA)
      .from("compare_data_draft")
      .select("draft_no, buyer, sap_sourcer, memo, updated_at")
      .eq("buyer", buyer)
      .eq("status", status)
      .order("draft_no", { ascending: true });

    let queryUserBuilder = supabase
      .schema(process.env.DB_SCHEMA)
      .from("b_user")
      .select("fullname, ename")
      .eq("username", buyer)
      .maybeSingle();

    const { data: userData, error: userError } = await queryUserBuilder;
    if (userError) throw userError; // 抛出錯誤

    const { data, error } = await queryBuilder;
    if (error) throw error; // 抛出錯誤

    if (userData) {
      // 遍歷 compare_data，為每個 item 加上 buyer 欄位
      data.forEach((item) => {
        item.buyer = `${userData.ename} ${userData.fullname}`;
      });
    }
    const filteredData = data.map((item) => {
      const { compare_apply, ...rest } = item; // 解構賦值，移除 compare_apply
      return rest; // 返回沒有 compare_apply 的對象
    });
    return filteredData;
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

async function createNweDraft() {
  const { data, error } = await supabase.schema(process.env.DB_SCHEMA);
  if (error) throw error;
  return data[0].draft_no_result;
}

async function updateDraftFields(draftNo, fields) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_data_draft")
    .update(fields)
    .eq("draft_no", draftNo);

  if (error) throw new Error(`updateDraftFields failed: ${error.message}`);

  return data;
}

async function createEmptyDraftWithBuyer(buyer) {
  const draftNo = await createNweDraft();
  if (!draftNo) throw new Error("Failed to get draft_no");
  await updateDraftFields(draftNo, { buyer });
  return draftNo;
}

async function createCopyFormDraft(formData) {
  const { title, items } = formData;
  const draftNo = await createNweDraft();
  await updateDraftFields(draftNo, {
    ...title,
  });

  const detailData = await buildDetailDataInChunks(items, draftNo, 50);

  const { error: detailError } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("compare_apply_draft")
    .insert(detailData);

  if (detailError) {
    console.error("❌ 明細儲存失敗:", detailError);
    throw detailError;
  }

  return draftNo;
}

async function getLastPrice(factoryCode, brandCode, vendorCode, parts) {
  try {
    let lastPrice = supabase
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

    const { data, error } = await lastPrice;
    if (error) throw error; // 抛出錯誤

    return data;
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

async function buildDetailDataInChunks(items, draftNo, batchSize = 50) {
  const chunks = chunkArray(items, batchSize);
  const out = [];

  for (const chunk of chunks) {
    const batch = await Promise.all(
      chunk.map(async (item) => {
        try {
          const lastPriceData = await getLastPrice(
            item.Factory.code,
            item.Brand.code,
            item.Vendor.code,
            item.Parts,
          );
          const lastPrice = lastPriceData?.lastprice ?? item.LastPutPrice;

          return {
            draft_no: draftNo,
            factory: item.Factory.code,
            vendor: item.Vendor.code,
            brand: item.Brand.code,
            buyer: item.Buyer.username,
            partsno: item.Parts,
            order_share_rate: item.OrderSharerate,
            last_price: lastPrice,
            last_price_currency: item.CurrencyOld, // 若後端回傳幣別可用 lastPriceData?.currency
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
            annulment_date:
              item.AnnulmentDate === "" ? null : item.AnnulmentDate,
            control_quantity: item.ControlQuantity,
            vendor_quotation_no: item.VendorQuotationNo,
            is_spot_price: item.IsSpotPrice,
            is_unpaid_order_effective: item.IsUnpaidOrderEffective,
            place_of_origin: item.PlaceOfOrigin,
          };
        } catch (e) {
          // 單筆失敗不拖累整批：回退到舊值
          return {
            draft_no: draftNo,
            factory: item.Factory.code,
            vendor: item.Vendor.code,
            brand: item.Brand.code,
            buyer: item.Buyer.username,
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
            annulment_date: item.AnnulmentDate,
            control_quantity: item.ControlQuantity,
            vendor_quotation_no: item.VendorQuotationNo,
            is_spot_price: item.IsSpotPrice,
            is_unpaid_order_effective: item.IsUnpaidOrderEffective,
            place_of_origin: item.PlaceOfOrigin,
          };
        }
      }),
    );
    out.push(...batch);
  }
  return out;
}

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

async function deleteDraft(draft_no, buyer) {
  try {
    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("compare_data_draft")
      .delete()
      .eq("draft_no", draft_no)
      .eq("buyer", buyer);
    if (error) throw error; // 抛出錯誤
    return true;
  } catch (err) {
    console.error("Error fetching data from Supabase:", err);
    throw new Error(err.message);
  }
}

// 路徑GET /api/users：取得所有用戶列表。
router.get("/", async (req, res) => {
  const {
    buyer,
    status,
    apply_no,
    dateStart,
    dateEnd,
    partsno,
    searchUsername,
    page,
  } = req.query;
  const deptSet = new Set(req.user.dept || []);
  const roleSet = new Set(req.user.role || []);

  let company = "UNKNOWN";

  company = req.user.factory;
  const searchArr = {
    status,
    apply_no,
    dateStart,
    dateEnd,
    partsno,
    company,
    searchUsername,
  };

  await logAction(`[compare-data] Fetching list`, "info", req);

  try {
    if (isMock) {
      const mockData = getMockData(searchArr);
      console.log("Using mock data for compare-data:", mockData);
      await logAction(
        `Using mock data for compare-data: ${JSON.stringify(mockData)}`,
        "info",
        req,
      );
      return res.status(200).json({
        status: "success",
        message: "Data fetched successfully (mock)",
        data: mockData,
        totalPages: 1,
      });
    }

    const data = await getData(buyer, status, searchArr, page || 1);

    if (!data || data.length === 0) {
      await logAction(`No data found for compare-data`, "warn", req);
      return res.status(200).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }
    await logAction(`Found ${data.length} data`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data.filteredData,
      totalPages: data.totalPages,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /compare-data: ${error.message}`,
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
  const { buyer, status } = req.query;

  await logAction(
    `GET /compare-data/draft?buyer=${buyer}&status=${status}`,
    "info",
    req,
  );

  try {
    if (isMock) {
      const mockData = getMockDraftData(buyer, status);
      await logAction(`Using mock data for compare-data/draft`, "info", req);
      return res.status(200).json({
        status: "success",
        message: "Mock data returned.",
        data: mockData,
      });
    }

    const data = await getDataDraft(buyer, status);
    if (!data || data.length === 0) {
      await logAction(`No data found for compare-data/draft`, "warn", req);
      return res.status(200).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    await logAction(`Found ${data.length} data`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /compare-data/draft: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/draft", async (req, res) => {
  const { buyer } = req.query;

  await logAction(`POST /compare-data/draft?buyer=${buyer}`, "info", req);
  try {
    if (isMock) {
      const draftNo = nextMockDraftNo();
      mockCompareStore.drafts.push({
        compare_data_draft: {
          draft_no: draftNo,
          buyer: normalizeMockBuyer(null, buyer, req.user),
          sap_sourcer: null,
          memo: "",
          status: "draft",
          updated_at: new Date().toISOString(),
        },
        compare_apply_draft: [],
      });
      await logAction(`Using mock data for compare-data/draft`, "info", req);
      return res.status(200).json({
        status: "success",
        message: "Mock data returned.",
        data: draftNo,
      });
    }
    const data = await createEmptyDraftWithBuyer(buyer);
    if (!data || data.length === 0) {
      await logAction(`No data found for compare-data/draft`, "warn", req);
      return res.status(200).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    await logAction(`Found ${data.length} data`, "info", req);

    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in POST /compare-data/draft: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/copy", async (req, res) => {
  const { buyer } = req.query;
  const { formData } = req.body;
  await logAction(`POST /compare-data/draft?buyer=${buyer}`, "info", req);
  try {
    const data = isMock
      ? (() => {
          const draftNo = nextMockDraftNo();
          const parsedFormData = parseMockValue(formData, {});
          const parsedTitle = parsedFormData?.title ?? {};
          mockCompareStore.drafts.push({
            compare_data_draft: {
              draft_no: draftNo,
              ...parsedTitle,
              buyer: normalizeMockBuyer(parsedTitle.buyer, buyer, req.user),
              sap_sourcer: normalizeMockSourcer(
                parsedTitle.sap_sourcer,
                parsedTitle.sap_sourcer_username,
              ),
              status: "draft",
              updated_at: new Date().toISOString(),
            },
            compare_apply_draft: cloneMockCompareData(
              parsedFormData?.items ?? [],
            ),
          });
          return draftNo;
        })()
      : await createCopyFormDraft(formData);
    if (!data || data.length === 0) {
      await logAction(
        `No data found for /compare-data/draft?buyer=${buyer}`,
        "warn",
        req,
      );
      return res.status(200).json({
        status: "error",
        message: "No data found.",
        data: [],
      });
    }

    // await logAction(`Found ${data.length} data`, 'info', req);

    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data: data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in POST /compare-data/draft?buyer=${buyer}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.delete("/draft", async (req, res) => {
  const { draft_no, username } = req.body;
  // console.log(draft_no, username);

  await logAction(`DELETE draft_no: ${draft_no}`, "info", req);
  try {
    const result = isMock
      ? (() => {
          const beforeLength = mockCompareStore.drafts.length;
          mockCompareStore.drafts = mockCompareStore.drafts.filter(
            (item) =>
              item.compare_data_draft.draft_no !== draft_no ||
              (username &&
                item.compare_data_draft.buyer?.username !== username &&
                item.compare_data_draft.buyer !== username),
          );
          return mockCompareStore.drafts.length < beforeLength;
        })()
      : await deleteDraft(draft_no, username);
    if (result) {
      await logUserAction({
        user: req.user,
        action: "delete",
        module: "Procurement",
        detail: JSON.stringify({
          status: "success",
          reason: "Draft deleted successfully.",
          draft_no,
        }),
        req,
      });

      await logAction(`Draft deleted successfully`, "info", req);
      res.status(200).json({
        status: "success",
        message: "Draft deleted successfully",
      });
    }
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /compare-data/draft: ${error.message}`,
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
