import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import { logAction, logUserAction } from "../../utils/useLogger.js";
import {
  createRepairApplication,
  getRepairApplicationLists,
  getRepairApplicationDetails,
  updateRepairItemWithFiles,
} from "../../services/calibration/repairService.js";

const isMock = process.env.USE_MOCK === "true";
const MOCK_LIMIT = 20;

let mockRepairApplications = [
  {
    id: 1,
    apply_no: "MOCK-REPAIR-0001",
    applicant: "8892",
    applicant_info: "Mock Applicant",
    requester: "8892",
    requester_info: "Mock Requester",
    requester_dept: "Calibration Department",
    factory: "TPE",
    status: "repairing",
    created_at: "2026-06-01T08:00:00.000Z",
    gauge_instrument_repair_item: [
      {
        id: 1,
        application_id: 1,
        calibration_id: 10001,
        property_no: "MOCK-00001",
        instru_name: "Power Meter",
        vendor: "Keysight",
        model: "MODEL-1001",
        owner: "8892",
        owner_info: "Mock Owner",
        dept: "Calibration Department",
        fault_condition_description: "Display is unstable.",
        repair_order_number: "",
        repair_date: null,
        revised_date: null,
        memo: "",
        status: "repairing",
        gauge_instrument_repair_item_file: [],
      },
    ],
  },
  {
    id: 2,
    apply_no: "MOCK-REPAIR-0002",
    applicant: "8967",
    applicant_info: "Mock Applicant 2",
    requester: "8967",
    requester_info: "Mock Requester 2",
    requester_dept: "Engineering Department",
    factory: "TAO",
    status: "finished",
    created_at: "2026-05-15T08:00:00.000Z",
    gauge_instrument_repair_item: [
      {
        id: 2,
        application_id: 2,
        calibration_id: 10002,
        property_no: "MOCK-00002",
        instru_name: "Oscilloscope",
        vendor: "Tektronix",
        model: "MODEL-2045",
        owner: "8967",
        owner_info: "Mock Owner 2",
        dept: "Engineering Department",
        fault_condition_description: "Unable to power on.",
        repair_order_number: "MOCK-RO-0001",
        repair_date: "2026-05-16",
        revised_date: "2026-05-20",
        memo: "Power supply replaced.",
        status: "finished",
        gauge_instrument_repair_item_file: [
          {
            id: 1,
            item_id: 2,
            file_name: "mock-repair-report.pdf",
            file_type: "pdf",
            file_url: "mock://mock-repair-report.pdf",
            uploaded_by: "8967",
          },
        ],
      },
    ],
  },
];

const normalize = (value) => value?.toString().trim().toLowerCase() ?? "";

const nextMockId = (items) =>
  Math.max(0, ...items.map((item) => Number(item.id)).filter(Number.isFinite)) +
  1;

const getMockRepairItems = () =>
  mockRepairApplications.flatMap(
    (application) => application.gauge_instrument_repair_item || [],
  );

const getMockRepairFiles = () =>
  getMockRepairItems().flatMap(
    (item) => item.gauge_instrument_repair_item_file || [],
  );

const getMockRepairApplicationDetails = (applyNo) => {
  const data = mockRepairApplications.find(
    (item) => String(item.apply_no) === String(applyNo),
  );

  return data
    ? { status: "success", data }
    : { status: "error", message: "Repair application not found" };
};

const getMockRepairApplicationLists = (queryParams = {}) => {
  const {
    property_no,
    status,
    apply_no,
    instru_name,
    applicant,
    start_date,
    end_date,
    factory,
    pages = 1,
  } = queryParams;

  const filteredData = mockRepairApplications.filter((application) => {
    const items = application.gauge_instrument_repair_item || [];

    if (factory && application.factory !== factory) return false;
    if (status && status !== "All" && application.status !== status) {
      return false;
    }
    if (
      apply_no &&
      !normalize(application.apply_no).includes(normalize(apply_no))
    ) {
      return false;
    }
    if (applicant && application.applicant !== applicant) return false;
    if (start_date && application.created_at.slice(0, 10) < start_date) {
      return false;
    }
    if (end_date && application.created_at.slice(0, 10) > end_date) {
      return false;
    }
    if (
      property_no &&
      !items.some((item) =>
        normalize(item.property_no).includes(normalize(property_no)),
      )
    ) {
      return false;
    }
    if (
      instru_name &&
      !items.some((item) =>
        normalize(item.instru_name).includes(normalize(instru_name)),
      )
    ) {
      return false;
    }

    return true;
  });

  const page = Math.max(1, Number(pages) || 1);
  const offset = (page - 1) * MOCK_LIMIT;

  return {
    status: "success",
    data: filteredData.slice(offset, offset + MOCK_LIMIT),
    count: filteredData.length,
    totalPages: Math.ceil(filteredData.length / MOCK_LIMIT),
  };
};

const createMockRepairApplication = (
  applicationData = {},
  repairItems = [],
) => {
  const applicationId = nextMockId(mockRepairApplications);
  const existingItems = getMockRepairItems();
  let itemId = nextMockId(existingItems);
  const application = {
    ...applicationData,
    id: applicationId,
    apply_no: `MOCK-REPAIR-${String(applicationId).padStart(4, "0")}`,
    applicant_info:
      applicationData.applicant_info ||
      `Mock User (${applicationData.applicant || "unknown"})`,
    requester_info:
      applicationData.requester_info ||
      `Mock User (${applicationData.requester || "unknown"})`,
    status: applicationData.status || "repairing",
    created_at: applicationData.created_at || new Date().toISOString(),
    gauge_instrument_repair_item: repairItems.map(({ id, ...item }) => ({
      ...item,
      id: itemId++,
      application_id: applicationId,
      owner_info: item.owner_info || `Mock User (${item.owner || "unknown"})`,
      status: applicationData.status || "repairing",
      repair_order_number: item.repair_order_number || "",
      repair_date: item.repair_date || null,
      revised_date: item.revised_date || null,
      memo: item.memo || "",
      gauge_instrument_repair_item_file: [],
    })),
  };

  mockRepairApplications.push(application);
  return { status: "success", data: applicationId };
};

const updateMockRepairItemWithFiles = (user, payload, files = []) => {
  const application = mockRepairApplications.find(
    (item) =>
      String(item.id) === String(payload.apply_no) ||
      String(item.apply_no) === String(payload.apply_no),
  );
  if (!application) {
    return { status: "error", message: "Repair application not found" };
  }

  for (const updatedItem of payload.gauge_instrument_repair_item || []) {
    const item = application.gauge_instrument_repair_item.find(
      (candidate) => String(candidate.id) === String(updatedItem.id),
    );
    if (!item) continue;

    Object.assign(item, {
      repair_order_number: updatedItem.repair_order_number || "",
      repair_date: updatedItem.repair_date || null,
      revised_date: updatedItem.revised_date || null,
      memo: updatedItem.memo || "",
      status: payload.status,
    });
  }

  const deletedFileIds = new Set(
    (payload.delete_file_id || []).map(([fileId]) => String(fileId)),
  );
  for (const item of application.gauge_instrument_repair_item) {
    item.gauge_instrument_repair_item_file = (
      item.gauge_instrument_repair_item_file || []
    ).filter((file) => !deletedFileIds.has(String(file.id)));
  }

  let fileId = nextMockId(getMockRepairFiles());
  for (const { file, itemId } of files) {
    const item = application.gauge_instrument_repair_item.find(
      (candidate) => String(candidate.id) === String(itemId),
    );
    if (!item) continue;

    item.gauge_instrument_repair_item_file ||= [];
    item.gauge_instrument_repair_item_file.push({
      id: fileId++,
      item_id: item.id,
      file_name: file.originalname,
      file_type: file.mimetype?.split("/").pop() || "file",
      file_url: `mock://${file.originalname}`,
      uploaded_by: user?.username || "mock",
    });
  }

  application.status = payload.status || application.status;
  return { status: "success", message: "Repair item updated successfully." };
};

const emptyStringToNull = (obj) => {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === "string" && out[key].trim() === "") {
      out[key] = null;
    }
  }
  return out;
};

router.get("/:apply_no", upload.none(), async (req, res) => {
  const { apply_no } = req.params;
  try {
    const result = isMock
      ? getMockRepairApplicationDetails(apply_no)
      : await getRepairApplicationDetails(apply_no);
    if (result.status === "error") {
      return res.status(400).json({
        status: "error",
        message: result.message,
      });
    }
    res.status(200).json({
      status: "success",
      message: "Calibration fetched successfully",
      data: result.data,
    });
  } catch (err) {
    console.error("Error fetching calibration:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch calibration",
    });
  }
});

router.get("/", upload.none(), async (req, res) => {
  const queryParams = emptyStringToNull(req.query);
  queryParams.factory = req.user.factory || "";
  const result = isMock
    ? getMockRepairApplicationLists(queryParams)
    : await getRepairApplicationLists(queryParams);

  if (result.status === "error") {
    return res.status(400).json({
      status: "error",
      message: result.message,
    });
  }

  const { data, count, totalPages } = result;

  res.status(200).json({
    status: "success",
    message: "Repair applications fetched successfully",
    data,
    count,
    totalPages,
  });
});

router.post("/", upload.none(), async (req, res) => {
  const payload = emptyStringToNull(req.body);
  const result = isMock
    ? createMockRepairApplication(payload.header, payload.instruments)
    : await createRepairApplication(payload.header, payload.instruments);

  if (result.status === "error") {
    return res.status(400).json({
      status: "error",
      message: result.message,
    });
  }
  res.status(200).json({
    status: "success",
    message: "Repair application created successfully",
    data: result.data,
  });
});

router.put("/", upload.any(), async (req, res) => {
  const { ...reqBody } = req.body;
  const files = req.files;
  const payload = {
    ...reqBody,
    gauge_instrument_repair_item: JSON.parse(
      reqBody.gauge_instrument_repair_item || "[]",
    ),
    delete_file_id: JSON.parse(reqBody.delete_file_id || "[]"),
  };
  console.log(payload);
  const itemIds = Array.isArray(reqBody.AttachFile_item_id)
    ? reqBody.AttachFile_item_id
    : reqBody.AttachFile_item_id
      ? [reqBody.AttachFile_item_id]
      : [];

  const filesWithItemId = files.map((file, index) => ({
    file,
    itemId: Number(itemIds[index]),
  }));
  await logAction(`PUT /calibration/repair`, "info", req);
  try {
    const result = isMock
      ? updateMockRepairItemWithFiles(req.user, payload, filesWithItemId)
      : await updateRepairItemWithFiles(req.user, payload, filesWithItemId);

    if (result.status === "error") {
      return res.status(400).json({
        status: "error",
        message: result.message,
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Instrument repair updated successfully",
      data: result.data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration/repair: ${error.message}`,
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
