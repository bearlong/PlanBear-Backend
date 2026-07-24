import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import supabase from "../../configs/supabase.js";
import { logAction, logUserAction } from "../../utils/useLogger.js";
import {
  createCalibration,
  getDistinctOwnerView,
  getCalibrationListView,
  getCalibrationByIdView,
  updateCalibrationAndUploadFiles,
  getHistoryByIdView,
  addLogWithReport,
  updateCalibrationHistoryLog,
  approveCalibrationReport,
  rejectCalibrationReport,
  sendNotificationMailByIds,
  getHistoriesByFilter,
  getCalibrationStatisticsSelectOptions,
  getCalibrationStatistics,
  batchUpdateCalibrationsStatus,
  getSignatureById,
  getPropertyNoChangeHistory,
  deleteCalibrationWithFiles,
  saveCalibrationCost,
  receivedCalibrations,
  changeCalibrationPropertyNoById,
  deleteCalibrationCostById,
  deleteCalibrationLogById,
  getCalculationTime,
} from "../../services/calibration/calibrationService.js";
import {
  updateCalibrationAllOwners,
  getCalibrationLists,
} from "../../repositories/calibration/calibration.repo.js";
import { mockInstruments as mockInstrumentSeed } from "../../configs/mockInstruments.js";
import { mockHistory as mockHistorySeed } from "../../configs/mockhistory.js";

const isMock = process.env.USE_MOCK === "true";
const MOCK_LIMIT = 20;

let mockCalibrations = mockInstrumentSeed.map((item) => ({
  ...item,
  due_date: item.due_date ?? item.date ?? item.change_date ?? null,
  owner_username: item.owner_username ?? null,
  calibration_cost: item.calibration_cost ?? [],
  calibration_org: item.calibration_org ?? null,
  calibration_log: item.calibration_log ?? [],
}));

let mockHistories = [
  ...mockHistorySeed.map((item) => ({
    ...item,
    calibration_id: item.calibration_id ?? item.id,
    created_at: item.created_at ?? new Date().toISOString(),
    property_no:
      item.property_no ??
      mockCalibrations.find((calibration) => calibration.id === item.id)
        ?.property_no ??
      "",
    factory:
      item.factory ??
      mockCalibrations.find((calibration) => calibration.id === item.id)
        ?.factory ??
      "",
    calibration_log_file: item.calibration_log_file ?? [],
  })),
  ...mockCalibrations.flatMap((item, index) => {
    const hasSeedHistory = mockHistorySeed.some(
      (history) => String(history.calibration_id) === String(item.id),
    );
    if (hasSeedHistory) return [];

    return [
      {
        id: 90000 + index * 2,
        calibration_id: item.id,
        property_no: item.property_no,
        factory: item.factory,
        status: "Usable",
        remark: "Mock initial usable status",
        requires_report_approval: "Y",
        calibman: "System",
        created_at: item.created_at,
        change_date: item.change_date,
        due_date: item.due_date,
        calibration_log_file: [],
      },
    ];
  }),
];

let mockPropertyNoLogs = [];

let mockCalibrationLists = [
  {
    id: 1,
    instru_name: "Micrometer",
    system: "QA",
  },
  {
    id: 2,
    instru_name: "Caliper",
    system: "QA",
  },
  {
    id: 3,
    instru_name: "Torque Wrench",
    system: "Production",
  },
  {
    id: 4,
    instru_name: "Digital Multimeter",
    system: "Engineering",
  },
];

let mockCalibrationOrgs = [
  {
    id: 1,
    name: "Calibration Lab",
    address: "No. 1, Test Rd.",
    tel: "02-1234-5678",
    fax: "02-1234-5679",
    contact: "Bear Shen",
    email: "calibration.lab@example.com",
    factory: "TAO",
    mobile: "0912-345-678",
  },
  {
    id: 2,
    name: "QA Verification Center",
    address: "No. 2, QA Ave.",
    tel: "03-2222-3333",
    fax: "03-2222-3334",
    contact: "QA Owner",
    email: "qa.verify@example.com",
    factory: "TAO",
    mobile: "0922-333-444",
  },
  {
    id: 3,
    name: "Engineering Lab",
    address: "No. 3, Engineering Blvd.",
    tel: "04-3333-4444",
    fax: "04-3333-4445",
    contact: "Engineering Owner",
    email: "eng.lab@example.com",
    factory: "TPE",
    mobile: "0933-444-555",
  },
  {
    id: 4,
    name: "Bear Calibration Lab",
    address: "No. 3, Engineering Blvd.",
    tel: "04-8888-7777",
    fax: "04-6666-7777",
    contact: "大壯",
    email: "eng.lab@example.com",
    factory: "TXG",
    mobile: "0933-123-321",
  },
];

const formatDate = (date) => (date ? String(date).slice(0, 10) : null);
const normalize = (value) => value?.toString().trim().toLowerCase() ?? "";
const parseBooleanFilter = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "1" || value === "true") return true;
  if (value === false || value === "0" || value === "false") return false;
  return undefined;
};

const getMockCalibrationById = (id) => {
  const item = mockCalibrations.find(
    (calibration) => String(calibration.id) === String(id),
  );
  if (!item) return null;

  return {
    ...item,
    calibration_log: mockHistories
      .filter((history) => String(history.calibration_id) === String(item.id))
      .map(({ calibration_log_file, ...history }) => history)
      .sort((a, b) => Number(a.id) - Number(b.id)),
  };
};

const filterMockCalibrations = (queryParams = {}) => {
  const {
    searchQuery = "",
    status = "",
    factory = "",
    dept = "",
    calibClass = "",
    instrumentId,
    dueDateFrom = "",
    dueDateTo = "",
    changeDateFrom = "",
    changeDateTo = "",
    oversee = "",
    standard = "",
    is_common = "",
    is_medical_equipment = "",
    onlyOverdue,
    reportApproval,
  } = queryParams;
  console.log("Filtering with params:", queryParams);
  const boolFilters = {
    oversee: parseBooleanFilter(oversee),
    standard: parseBooleanFilter(standard),
    is_common: parseBooleanFilter(is_common),
    is_medical_equipment: parseBooleanFilter(is_medical_equipment),
  };
  const today = new Date().toISOString().slice(0, 10);
  const q = normalize(searchQuery);

  return mockCalibrations.filter((item) => {
    if (q) {
      const values = [
        item.property_no,
        item.vendor,
        item.model,
        item.owner,
        item.owner_username,
        item.description,
        item.instru_sn,
        item.sub_instru_id,
        item.dept,
        item.instrument?.instru_name,
        item.instrument?.system,
      ];
      if (!values.some((value) => normalize(value).includes(q))) return false;
    }
    if (status && item.status !== status) return false;
    if (factory && item.factory !== factory) return false;
    if (dept && item.dept !== dept) return false;
    if (calibClass && item.calibr_class !== calibClass) return false;
    if (
      instrumentId !== undefined &&
      instrumentId !== null &&
      instrumentId !== "" &&
      instrumentId !== "null" &&
      Number(item.instrument?.id) !== Number(instrumentId)
    ) {
      return false;
    }
    if (dueDateFrom && formatDate(item.due_date) < dueDateFrom) return false;
    if (dueDateTo && formatDate(item.due_date) > dueDateTo) return false;
    if (changeDateFrom && formatDate(item.change_date) < changeDateFrom) {
      return false;
    }
    if (changeDateTo && formatDate(item.change_date) > changeDateTo) {
      return false;
    }
    for (const [key, value] of Object.entries(boolFilters)) {
      if (value !== undefined && item[key] !== value) return false;
    }
    if (onlyOverdue && formatDate(item.due_date) >= today) return false;
    if (reportApproval) {
      const signature = mockHistories.find(
        (history) =>
          String(history.id) === String(item.id) &&
          history.requires_report_approval === "T",
      );
      console.log(
        `Checking report approval for calibration ID ${item.id}:`,
        signature,
      );
      if (!signature) return false;
    }
    return true;
  });
};

const getMockCalibrationListView = (queryParams = {}) => {
  const pages = Number(queryParams.pages) || 1;
  const paginate = queryParams.paginate !== false;
  const filteredData = filterMockCalibrations(queryParams).sort(
    (a, b) => new Date(a.due_date ?? 0) - new Date(b.due_date ?? 0),
  );
  const offset = (pages - 1) * MOCK_LIMIT;
  const enriched = paginate
    ? filteredData.slice(offset, offset + MOCK_LIMIT)
    : filteredData;

  return {
    enriched,
    count: filteredData.length,
    totalPages: paginate ? Math.ceil(filteredData.length / MOCK_LIMIT) : 1,
  };
};

const getMockHistoryByCalibrationId = (calibrationId) =>
  mockHistories
    .filter((item) => String(item.calibration_id) === String(calibrationId))
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((item) => ({
      id: item.id,
      calibration_log_file: item.calibration_log_file ?? [],
      status: item.status,
      remark: item.remark,
      requires_report_approval: item.requires_report_approval,
      created_at: formatDate(item.created_at),
      due_date: formatDate(item.due_date),
      change_date: formatDate(item.change_date),
      calibration_id: item.calibration_id,
    }));

const getMockDistinctOwners = () => {
  const ownerMap = new Map();
  mockCalibrations.forEach((item) => {
    const key = item.owner_username ?? item.owner;
    if (!key) return;
    ownerMap.set(key, {
      owner: item.owner,
      owner_username: item.owner_username ?? null,
    });
  });
  return [...ownerMap.values()];
};

const getMockStatisticOptions = () => {
  const depts = [
    ...new Set(mockCalibrations.map((item) => item.dept).filter(Boolean)),
  ];
  const factories = [
    ...new Set(mockCalibrations.map((item) => item.factory).filter(Boolean)),
  ];
  return [
    ...depts.sort().map((dept) => ({ label: dept, value: `dept|${dept}` })),
    ...factories
      .sort()
      .map((factory) => ({ label: factory, value: `factory|${factory}` })),
  ];
};

const getMockStatistics = (type, eGroup) => {
  const items = filterMockCalibrations({
    paginate: false,
    dept: type === "dept" ? eGroup : undefined,
    factory: type === "factory" ? eGroup : undefined,
  });
  const groupedData = items.reduce((acc, item) => {
    const key = item.instrument?.instru_name || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return Object.entries(groupedData).map(([groupName, groupItems]) => ({
    groupName,
    system: groupItems[0].instrument?.system || "Unknown",
    count: groupItems.length,
    items: groupItems,
  }));
};

const getMockSignatureById = (calibrationId) =>
  mockHistories.find(
    (item) =>
      String(item.calibration_id) === String(calibrationId) &&
      item.requires_report_approval === "T",
  );

const getMockHistoriesByFilter = (filter = {}) => {
  const {
    factory,
    dateType = "change_date",
    calibrationClass,
    dateFrom,
    dateTo,
  } = filter;
  console.log(mockHistories);
  return mockHistories
    .filter((history) => {
      const calibration = getMockCalibrationById(history.calibration_id);
      if (!calibration) return false;
      if (factory && history.factory !== factory) return false;
      if (calibrationClass && calibration.calibr_class !== calibrationClass) {
        return false;
      }
      if (dateFrom && formatDate(history[dateType]) < dateFrom) return false;
      if (dateTo && formatDate(history[dateType]) > dateTo) return false;
      return true;
    })
    .map((history) => {
      const calibration = getMockCalibrationById(history.calibration_id);
      return {
        ...history,
        calibration: {
          id: calibration.id,
          property_no: calibration.property_no,
          dept: calibration.dept,
          factory: calibration.factory,
          vendor: calibration.vendor,
          model: calibration.model,
          calibr_class: calibration.calibr_class,
          calibration_cost: calibration.calibration_cost ?? [],
        },
        calibration_log_file: history.calibration_log_file ?? [],
      };
    });
};

const nextMockId = (items) =>
  Math.max(0, ...items.map((item) => Number(item.id)).filter(Number.isFinite)) +
  1;

const addMockHistory = (calibration, payload = {}) => {
  const newLog = {
    id: nextMockId(mockHistories),
    calibration_id: calibration.id,
    property_no: calibration.property_no,
    factory: calibration.factory,
    status: payload.status ?? calibration.status,
    remark: payload.remark ?? null,
    requires_report_approval: payload.requires_report_approval ?? "Y",
    calibman: payload.calibman ?? "Mock User",
    created_at: payload.created_at ?? new Date().toISOString(),
    change_date: payload.change_date ?? calibration.change_date,
    due_date: payload.due_date ?? calibration.due_date,
    calibration_log_file: payload.calibration_log_file ?? [],
  };
  mockHistories.push(newLog);
  return newLog;
};

const parseMockIds = (value) => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (error) {
      return value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    }
  }
  return [];
};

/**
 * @swagger
 * /Calibration/calibration/distinct-owner:
 *   get:
 *     summary: Get distinct calibration owners
 *     tags:
 *       - Calibration
 *     description: Retrieve distinct owner names from calibration records.
 *     parameters: []
 *     responses:
 *       200:
 *         description: Success, distinct owners retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Distinct owners retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Lab A", "Lab B"]
 *       404:
 *         description: No distinct owners found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "No distinct owners found"
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
 * /Calibration/calibration/update-owners:
 *   put:
 *     summary: Update calibration owners in bulk
 *     tags:
 *       - Calibration
 *     description: Update all calibration records with the specified owner.
 *     parameters:
 *       - in: body
 *         name: body
 *         description: Owner update payload.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             oldOwner:
 *               type: string
 *               example: "Lab A"
 *             newOwner:
 *               type: string
 *               example: "Lab B"
 *     requestBody:
 *       description: Owner update payload (oldOwner, newOwner).
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - oldOwner
 *               - newOwner
 *             properties:
 *               oldOwner:
 *                 type: string
 *                 example: "Lab A"
 *               newOwner:
 *                 type: string
 *                 example: "Lab B"
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - oldOwner
 *               - newOwner
 *             properties:
 *               oldOwner:
 *                 type: string
 *                 example: "Lab A"
 *               newOwner:
 *                 type: string
 *                 example: "Lab B"
 *     responses:
 *       200:
 *         description: Success, owners updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Owner updated successfully for 3 records"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       owner:
 *                         type: string
 *                         example: "Lab B"
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

router.get("/distinct-owner", async (req, res) => {
  await logAction(`GET /calibration/distinct-owner`, "info", req);
  try {
    const data = isMock
      ? getMockDistinctOwners()
      : await getDistinctOwnerView();
    if (!data) {
      await logAction(`No distinct owners found`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "No distinct owners found",
        data: [],
      });
    }

    await logAction(`Found ${data.length} distinct owners`, "info", req);
    res.status(200).json({
      status: "success",
      message: "Distinct owners retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/distinct-owner: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});
router.get("/propertyNoChangeHistory", async (req, res) => {
  await logAction(`GET /calibration/propertyNoChangeHistory`, "info", req);
  try {
    const { type, id } = req.query;

    const data = isMock
      ? mockPropertyNoLogs.filter((item) =>
          type === "device"
            ? String(item.calibration_id) === String(id)
            : String(item.update_by) === String(id),
        )
      : await getPropertyNoChangeHistory(type, id);

    await logAction(`Fetched ${data.length} calibration records`, "info", req);
    res.status(200).json({
      status: "success",
      message: "Calibration records retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/report-search", async (req, res) => {
  await logAction(
    `GET /calibration/report-search, query: ${JSON.stringify(req.query)}`,
    "info",
    req,
  );
  if (!req.query || Object.keys(req.query).length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Search conditions are required",
    });
  }
  try {
    const filters = {
      ...req.query,
    };

    const data = isMock
      ? getMockHistoriesByFilter(filters)
      : await getHistoriesByFilter(filters);
    await logAction(
      `Fetched ${data.length} calibration history records`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration history retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/report-search: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/calculation-time", async (req, res) => {
  await logAction(
    `GET /calibration/calculation-time, query: ${JSON.stringify(req.query)}`,
    "info",
    req,
  );
  if (!req.query || Object.keys(req.query).length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Search conditions are required",
    });
  }
  try {
    const filters = req.query;
    filters.dateType = "change_date";
    const data = isMock
      ? {
          data: getMockHistoriesByFilter(filters),
          count: getMockHistoriesByFilter(filters).length,
          totalPages: 1,
        }
      : await getCalculationTime(filters);
    await logAction(
      `Fetched ${data.data?.length ?? data.length ?? 0} calibration history records`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration history retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/calculation-time: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/statistic-options", async (req, res) => {
  await logAction(`GET /calibration/statistic-options`, "info", req);
  try {
    const data = isMock
      ? getMockStatisticOptions()
      : await getCalibrationStatisticsSelectOptions();
    await logAction(
      `Fetched calibration statistic select options successfully`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration statistic select options retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/statistic-options: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/statistics", async (req, res) => {
  await logAction(`GET /calibration/statistic`, "info", req);
  const { type, e_group } = req.query;
  try {
    const data = isMock
      ? getMockStatistics(type, e_group)
      : await getCalibrationStatistics(type, e_group);

    await logAction(`Fetched calibration statistic successfully`, "info", req);
    res.status(200).json({
      status: "success",
      message: "Calibration statistic retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/statistic: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/signature/:id", async (req, res) => {
  const { id } = req.params;
  await logAction(`GET /calibration/signature/${id}`, "info", req);
  try {
    const data = isMock ? getMockSignatureById(id) : await getSignatureById(id);
    if (!data) {
      console.log("Retrieved signature data:", data);

      await logAction(`Signature with ID ${id} not found`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "Signature not found",
      });
    }
    await logAction(
      `Signature with ID ${id} retrieved successfully`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Signature retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/signature/${id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/history/:calibrationId", async (req, res) => {
  const { calibrationId } = req.params;
  await logAction(`GET /calibration/history/${calibrationId}`, "info", req);
  try {
    const data = isMock
      ? getMockHistoryByCalibrationId(calibrationId)
      : await getHistoryByIdView(calibrationId);
    if (!data) {
      await logAction(
        `Calibration history with calibrationId ${calibrationId} not found`,
        "warn",
        req,
      );
      return res.status(404).json({
        status: "error",
        message: "Calibration history not found",
      });
    }

    await logAction(
      `Calibration history with calibrationId ${calibrationId} retrieved successfully`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration history retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/history/${calibrationId}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  await logAction(`GET /calibration/${id}`, "info", req);
  try {
    const data = isMock
      ? getMockCalibrationById(id)
      : await getCalibrationByIdView(id);
    if (!data) {
      await logAction(`Calibration with ID ${id} not found`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "Calibration not found",
      });
    }

    await logAction(
      `Calibration with ID ${id} retrieved successfully`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/${id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  await logAction(`GET /calibration/`, "info", req);
  try {
    const {
      pages,
      searchQuery,
      status,
      factory,
      calibClass,
      instrumentId,
      dueDateFrom,
      dueDateTo,
      changeDateFrom,
      changeDateTo,
      oversee,
      standard,
      is_common,
      is_medical_equipment,
      onlyOverdue,
      reportApproval,
    } = req.query;
    const queryParams = {
      pages: Number(pages) || 1,
      searchQuery,
      status,
      factory,
      calibClass,
      instrumentId,
      dueDateFrom,
      dueDateTo,
      changeDateFrom,
      changeDateTo,
      oversee,
      standard,
      is_common,
      is_medical_equipment,
      onlyOverdue,
      reportApproval,
    };
    const data = isMock
      ? getMockCalibrationListView(queryParams)
      : await getCalibrationListView(queryParams);
    await logAction(
      `Fetched ${data.enriched?.length ?? data.length ?? 0} calibration records`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration records retrieved successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration/: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/log", upload.any(), async (req, res) => {
  const { ...reqBody } = req.body;
  const files = req.files;
  await logAction(`POST /calibration/log`, "info", req);
  try {
    if (isMock) {
      const calibration = getMockCalibrationById(reqBody.id);
      if (!calibration) {
        return res.status(404).json({
          status: "error",
          message: "Calibration not found",
        });
      }
      const log = addMockHistory(calibration, {
        status: reqBody.status ?? calibration.status,
        requires_report_approval: "T",
        calibman: req.user?.name ?? "Mock User",
        change_date: reqBody.change_date ?? calibration.change_date,
        due_date: reqBody.due_date ?? calibration.due_date,
        calibration_log_file: (files ?? []).map((file, index) => ({
          id: Date.now() + index,
          log_id: null,
          file_name: file.originalname,
          file_type: file.mimetype,
          file_url: `mock://${file.originalname}`,
          uploaded_by: req.user?.username ?? "mock",
        })),
      });
      log.calibration_log_file = log.calibration_log_file.map((file) => ({
        ...file,
        log_id: log.id,
      }));
      return res.status(200).json({
        status: "success",
        message: "Calibration log updated successfully",
        data: { status: "success", message: "Log added successfully." },
      });
    }

    const result = await addLogWithReport(req.user, reqBody, files);
    return res.status(200).json({
      status: "success",
      message: "Calibration log updated successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in POST /calibration/log: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/notify", upload.none(), async (req, res) => {
  const { ids } = req.body;

  try {
    if (!isMock && process.env.NODE_ENV === "production") {
      const result = await sendNotificationMailByIds(ids);

      if (result.status === "error") {
        return res.status(400).json({
          status: "error",
          message: result.message,
        });
      }
    }
    await logAction(`POST /calibration/notify`, "info", req);
    res.status(200).json({
      status: "success",
      message: "Notification sent successfully",
    });
  } catch (error) {
    await logAction(
      `Unhandled error in POST /calibration/notify: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: "Failed to send notification",
    });
  }
});

router.post("/", async (req, res) => {
  const reqBody = req.body;
  try {
    await logAction(`POST /calibration/`, "info", req);
    const instru_id = reqBody.instru_id;
    const instrument = isMock
      ? mockCalibrationLists.find(
          (item) => String(item.id) === String(instru_id),
        )
      : mockCalibrationLists;
    if (!instrument) {
      return res.status(404).json({
        status: "error",
        message: "Instrument not found",
      });
    }
    const external_calibr_id = reqBody.external_calibr_id;
    const calibration_org = isMock
      ? mockCalibrationOrgs.find(
          (item) => String(item.id) === String(external_calibr_id),
        )
      : mockCalibrationOrgs;
    if (!calibration_org) {
      return res.status(404).json({
        status: "error",
        message: "Calibration organization not found",
      });
    }
    const result = isMock
      ? (() => {
          const duplicated = mockCalibrations.some(
            (item) =>
              item.property_no === reqBody.property_no &&
              item.factory === reqBody.factory,
          );
          if (duplicated) {
            return {
              status: "error",
              message:
                "Calibration with the same property number already exists in this factory.",
            };
          }
          const newItem = {
            ...reqBody,
            instrument,
            calibration_org,
            id: nextMockId(mockCalibrations),
            created_at: new Date().toISOString(),
            due_date: reqBody.due_date ?? reqBody.date ?? reqBody.change_date,
            calibration_cost: [],
          };
          mockCalibrations.push(newItem);
          addMockHistory(newItem, {
            status: newItem.status ?? "Usable",
            requires_report_approval: "Y",
            calibman: "New Item",
          });
          return {
            status: "success",
            message: "Calibration created successfully.",
            data: { id: newItem.id },
          };
        })()
      : await createCalibration(reqBody);

    return res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in POST /calibration/: ${error.message}`,
      "error",
      req,
    );

    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/log/:log_id", upload.any(), async (req, res) => {
  const { log_id } = req.params;
  const { ...reqBody } = req.body;
  const files = req.files;
  await logAction(`PUT /calibration/log/${log_id}`, "info", req);
  try {
    if (isMock) {
      const index = mockHistories.findIndex(
        (item) => String(item.id) === String(log_id),
      );
      if (index === -1) {
        return res.status(404).json({
          status: "error",
          message: "Calibration log not found",
        });
      }
      mockHistories[index] = {
        ...mockHistories[index],
        ...reqBody,
        calibration_log_file: [
          ...(mockHistories[index].calibration_log_file ?? []),
          ...(files ?? []).map((file, fileIndex) => ({
            id: Date.now() + fileIndex,
            log_id: Number(log_id),
            file_name: file.originalname,
            file_type: file.mimetype,
            file_url: `mock://${file.originalname}`,
            uploaded_by: req.user?.username ?? "mock",
          })),
        ],
      };
      return res.status(200).json({
        status: "success",
        message: "Calibration log updated successfully",
        data: {
          status: "success",
          message: "Calibration log updated successfully.",
        },
      });
    }

    const result = await updateCalibrationHistoryLog(
      req.user,
      log_id,
      reqBody,
      files,
    );

    return res.status(200).json({
      status: "success",
      message: "Calibration log updated successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/log/${log_id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/propertyNo/:calibrationId", async (req, res) => {
  const { calibrationId } = req.params;
  const { ...reqBody } = req.body;
  await logAction(`PUT /calibration/propertyNo/${calibrationId}`, "info", req);
  try {
    if (isMock) {
      const calibration = getMockCalibrationById(calibrationId);
      if (!calibration) {
        return res.status(404).json({
          status: "error",
          message: "Calibration not found",
        });
      }
      const newPropertyNo = reqBody.propertyNo;
      const item = mockCalibrations.find(
        (calibrationItem) =>
          String(calibrationItem.id) === String(calibrationId),
      );
      item.property_no = newPropertyNo;
      mockHistories = mockHistories.map((history) =>
        String(history.calibration_id) === String(calibrationId)
          ? { ...history, property_no: newPropertyNo }
          : history,
      );
      const log = {
        id: nextMockId(mockPropertyNoLogs),
        calibration_id: Number(calibrationId),
        old_property_no: calibration.property_no,
        new_property_no: newPropertyNo,
        update_by: req.user?.username ?? "mock",
        update_by_name: req.user?.name ?? "Mock User",
        factory: calibration.factory,
        remark: reqBody.remark ?? null,
        created_at: new Date().toISOString(),
      };
      mockPropertyNoLogs.push(log);
      return res.status(200).json({
        status: "success",
        message: "Calibration log updated successfully",
        data: log,
      });
    }

    const result = await changeCalibrationPropertyNoById(
      calibrationId,
      reqBody,
      req.user,
    );

    return res.status(200).json({
      status: "success",
      message: "Calibration log updated successfully",
      data: result.data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/propertyNo/${calibrationId}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/cost", async (req, res) => {
  const { id, cost } = req.body;
  await logAction(`PUT /calibration/cost`, "info", req);
  try {
    if (isMock) {
      const calibration = mockCalibrations.find(
        (item) => String(item.id) === String(id),
      );
      if (!calibration) {
        return res.status(400).json({
          status: "error",
          message: "Calibration not found",
        });
      }
      calibration.calibration_cost = [
        {
          id: Number(id),
          calibration_id: Number(id),
          cost: Number(cost),
          update_by: req.user?.username ?? "mock",
          update_at: new Date().toISOString(),
        },
      ];
      return res.status(200).json({
        status: "success",
        message: "Calibration cost updated successfully",
        data: {
          status: "success",
          message: "Calibration cost saved successfully.",
        },
      });
    }

    const result = await saveCalibrationCost(id, cost, req.user);
    await logAction(`Calibration cost updated for ID ${id}`, "info", req);

    if (result.status === "error") {
      await logAction(
        `Failed to update calibration cost for ID ${id}: ${result.message}`,
        "error",
        req,
      );
      return res.status(400).json({
        status: "error",
        message: result.message,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Calibration cost updated successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/cost: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/batch-update-status", upload.none(), async (req, res) => {
  await logAction(`PUT /calibration/batch-update-status`, "info", req);
  try {
    const { ids, status, remark } = req.body;
    const idList = parseMockIds(ids);
    const result = isMock
      ? idList
          .map((id) => {
            const item = mockCalibrations.find(
              (calibration) => String(calibration.id) === String(id),
            );
            if (!item) return null;
            item.status = status;
            const log = addMockHistory(item, {
              status,
              remark,
              requires_report_approval: "Y",
              calibman: req.user?.name ?? "Mock User",
            });
            return log.id;
          })
          .filter(Boolean)
      : await batchUpdateCalibrationsStatus(ids, req.user, status, remark);
    await logAction(
      `Batch update calibrations with IDs: ${idList.join(", ")} to status: ${status}`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: `Calibrations updated to status ${status} successfully`,
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/batch-update-status  : ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/received", upload.none(), async (req, res) => {
  await logAction(`PUT /calibration/received`, "info", req);
  try {
    const ids = req.body;
    const idList = parseMockIds(ids);
    const result = isMock
      ? idList
          .map((id) => {
            const item = mockCalibrations.find(
              (calibration) => String(calibration.id) === String(id),
            );
            if (!item) return null;
            item.received = true;
            return item;
          })
          .filter(Boolean)
      : await receivedCalibrations(ids);
    await logAction(
      `Received calibrations with IDs: ${idList.join(", ")}`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibrations received successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/received: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/update-owners", upload.none(), async (req, res) => {
  await logAction(`PUT /calibration/update-owners`, "info", req);

  try {
    const { oldOwner, newOwner, dept } = req.body;
    const data = isMock
      ? mockCalibrations
          .filter(
            (item) =>
              item.owner_username === oldOwner || item.owner === oldOwner,
          )
          .map((item) => {
            item.owner_username = newOwner;
            item.owner = null;
            item.dept = dept;
            return item;
          })
      : await updateCalibrationAllOwners(oldOwner, newOwner, dept);
    await logAction(
      `Updated owner from ${oldOwner} to ${newOwner} for ${data.length} records`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: `Owner updated successfully for ${data.length} records`,
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/update-owners: ${error.message}`,
      "error",
      req,
    );

    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/approve/:log_id", upload.none(), async (req, res) => {
  await logAction(`PUT /calibration/approve/${req.params.log_id}`, "info", req);
  try {
    const { log_id } = req.params;
    const { instrument_id } = req.body;
    const result = isMock
      ? (() => {
          const log = mockHistories.find(
            (item) => String(item.id) === String(log_id),
          );
          const calibration = mockCalibrations.find(
            (item) => String(item.id) === String(instrument_id),
          );
          if (!log || !calibration) return null;
          log.requires_report_approval = "Y";
          log.remark = null;
          calibration.status = "Usable";
          calibration.received = false;
          calibration.change_date = log.change_date;
          calibration.due_date = log.due_date;
          return addMockHistory(calibration, {
            status: "Usable",
            requires_report_approval: "Y",
            calibman: req.user?.name ?? "Mock User",
          }).id;
        })()
      : await approveCalibrationReport(log_id, instrument_id, req.user);
    await logAction(
      `Approved calibration report with log ID ${log_id}`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration report approved successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/approve/${req.params.log_id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/reject/:log_id", upload.none(), async (req, res) => {
  await logAction(`PUT /calibration/reject/${req.params.log_id}`, "info", req);
  try {
    const { log_id } = req.params;
    const { instrument_id, reason } = req.body;
    const result = isMock
      ? (() => {
          const log = mockHistories.find(
            (item) => String(item.id) === String(log_id),
          );
          if (!log) return null;
          log.requires_report_approval = "R";
          log.remark = reason;
          return {
            status: "success",
            message: "Calibration report rejected.",
          };
        })()
      : await rejectCalibrationReport(log_id, instrument_id, reason, req.user);
    await logAction(
      `Rejected calibration report with log ID ${log_id}`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration report rejected successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/reject/${req.params.log_id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/:id", upload.any(), async (req, res) => {
  const { id } = req.params;
  const { ...reqBody } = req.body;
  const files = req.files;
  const instrumentId = reqBody.instru_id;
  const externalCalibrId = reqBody.external_calibr_id;
  const instrument = isMock
    ? mockCalibrationLists.find(
        (item) => String(item.id) === String(instrumentId),
      )
    : mockCalibrationLists;
  const calibration_org = isMock
    ? mockCalibrationOrgs.find(
        (item) => String(item.id) === String(externalCalibrId),
      )
    : mockCalibrationOrgs;

  try {
    await logAction(`PUT /calibration/${id}`, "info", req);
    const result = isMock
      ? (() => {
          const index = mockCalibrations.findIndex(
            (item) => String(item.id) === String(id),
          );
          if (index === -1) throw new Error("Calibration not found");
          const before = mockCalibrations[index];
          mockCalibrations[index] = {
            ...before,
            ...reqBody,
            id: before.id,
            instrument: instrument,
            due_date: reqBody.due_date ?? before.due_date,
            calibration_org: calibration_org,
          };
          if (reqBody.status && reqBody.status !== before.status) {
            addMockHistory(mockCalibrations[index], {
              status: reqBody.status,
              remark: reqBody.scrap_remark ?? null,
              requires_report_approval: "Y",
              calibman: req.user?.name ?? "Mock User",
              calibration_log_file: (files ?? []).map((file, index) => ({
                id: Date.now() + index,
                file_name: file.originalname,
                file_type: file.mimetype,
                file_url: `mock://${file.originalname}`,
                uploaded_by: req.user?.username ?? "mock",
              })),
            });
          }
          return { id: Number(id) };
        })()
      : await updateCalibrationAndUploadFiles(req.user, id, reqBody, files);

    return res.status(200).json({
      status: "success",
      message: "Calibration updated successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/${id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.delete("/cost/:calibration_id", async (req, res) => {
  const { calibration_id } = req.params;
  await logAction(`DELETE /calibration/cost/${calibration_id}`, "info", req);
  try {
    const result = isMock
      ? (() => {
          const item = mockCalibrations.find(
            (calibration) => String(calibration.id) === String(calibration_id),
          );
          if (!item) throw new Error("Calibration not found");
          item.calibration_cost = [];
          return {
            status: "success",
            message: "Calibration cost deleted successfully.",
          };
        })()
      : await deleteCalibrationCostById(calibration_id);
    await logAction(
      `Deleted calibration cost for ID ${calibration_id}`,
      "info",
      req,
    );
    res.status(200).json({
      status: "success",
      message: "Calibration cost deleted successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /calibration/cost/${calibration_id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.delete("/log/:log_id", async (req, res) => {
  const { log_id } = req.params;
  await logAction(`DELETE /calibration/log/${log_id}`, "info", req);
  try {
    const result = isMock
      ? (() => {
          const beforeLength = mockHistories.length;
          mockHistories = mockHistories.filter(
            (history) => String(history.id) !== String(log_id),
          );
          if (mockHistories.length === beforeLength) {
            throw new Error("Calibration log not found");
          }
          return {
            status: "success",
            message: "Calibration log deleted successfully.",
          };
        })()
      : await deleteCalibrationLogById(log_id);
    await logAction(`Deleted calibration log for ID ${log_id}`, "info", req);
    res.status(200).json({
      status: "success",
      message: "Calibration log deleted successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /calibration/log/${req.params.log_id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await logAction(`DELETE /calibration/${id}`, "info", req);
  try {
    const result = isMock
      ? (() => {
          const beforeLength = mockCalibrations.length;
          mockCalibrations = mockCalibrations.filter(
            (item) => String(item.id) !== String(id),
          );
          if (mockCalibrations.length === beforeLength) {
            return {
              status: "error",
              message: "Calibration not found",
            };
          }
          mockHistories = mockHistories.filter(
            (history) => String(history.calibration_id) !== String(id),
          );
          return {
            status: "success",
            message: "Calibration deleted successfully.",
          };
        })()
      : await deleteCalibrationWithFiles(id);
    await logAction(`Deleted calibration with ID ${id}`, "info", req);

    if (result.status === "error") {
      await logAction(
        `Failed to delete calibration with ID ${id}: ${result.message}`,
        "error",
        req,
      );
      return res.status(400).json({
        status: "error",
        message: result.message,
      });
    }
    res.status(200).json({
      status: "success",
      message: "Calibration deleted successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /calibration/${id}: ${error.message}`,
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
