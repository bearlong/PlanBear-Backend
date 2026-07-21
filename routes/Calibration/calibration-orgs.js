import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();
import { logAction, logUserAction } from "../../utils/useLogger.js";
import {
  getCalibrationOrg,
  addCalibrationOrg,
  updateCalibrationOrg,
  deleteCalibrationOrg,
} from "../../services/calibration/calibrationOrgService.js";

const isMock = process.env.USE_MOCK === "true";
const DEFAULT_LIMIT = 20;

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

/**
 * @swagger
 * /Calibration/calibration-orgs:
 *   get:
 *     summary: Get calibration org list
 *     tags:
 *       - Calibration
 *     description: Retrieve calibration organizations with optional filters and pagination.
 *     parameters:
 *       - in: query
 *         name: query
 *         description: Search term to filter by org name.
 *         required: false
 *         schema:
 *           type: string
 *           example: "Lab"
 *       - in: query
 *         name: p
 *         description: Page number for pagination.
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         description: Page size for pagination.
 *         required: false
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: Success, calibration orgs retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Calibration orgs retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "Calibration Lab"
 *                     count:
 *                       type: integer
 *                       example: 12
 *                     totalPages:
 *                       type: integer
 *                       example: 1
 *       404:
 *         description: No data found
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
 *     summary: Add calibration org
 *     tags:
 *       - Calibration
 *     description: Create a calibration organization.
 *     parameters:
 *       - in: body
 *         name: body
 *         description: Calibration org payload.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "Calibration Lab"
 *     requestBody:
 *       description: Calibration org payload (name).
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Calibration Lab"
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Calibration Lab"
 *     responses:
 *       200:
 *         description: Success, calibration org created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Instrument system added successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 501
 *       500:
 *         description: Internal Server Error or duplicate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: "DUPLICATE"
 *                 message:
 *                   type: string
 *                   example: "Org already exists"
 * /Calibration/calibration-orgs/{id}:
 *   put:
 *     summary: Update calibration org
 *     tags:
 *       - Calibration
 *     description: Update a calibration organization by id.
 *     parameters:
 *       - in: path
 *         name: id
 *         description: Calibration org id.
 *         required: true
 *         schema:
 *           type: integer
 *           example: 501
 *       - in: body
 *         name: body
 *         description: Calibration org payload.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "Calibration Lab"
 *     requestBody:
 *       description: Calibration org payload (name).
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Calibration Lab"
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Calibration Lab"
 *     responses:
 *       200:
 *         description: Success, calibration org updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Calibration org item updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 501
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
 *   delete:
 *     summary: Delete calibration org
 *     tags:
 *       - Calibration
 *     description: Delete a calibration organization by id.
 *     parameters:
 *       - in: path
 *         name: id
 *         description: Calibration org id.
 *         required: true
 *         schema:
 *           type: integer
 *           example: 501
 *     responses:
 *       200:
 *         description: Success, calibration org deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Calibration org item deleted successfully"
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

const emptyStringToNull = (obj) => {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === "string" && out[key].trim() === "") {
      out[key] = null;
    }
  }
  return out;
};

const normalize = (value) => value?.toString().trim().toLowerCase() ?? "";

const buildOrgPayload = (payload, user) => {
  const out = emptyStringToNull(payload);
  return {
    name: out.name ?? "",
    address: out.address ?? "",
    tel: out.tel ?? "",
    fax: out.fax ?? "",
    contact: out.contact ?? "",
    email: out.email ?? "",
    factory: out.factory ?? user?.factory ?? "",
    mobile: out.mobile ?? "",
  };
};

function getMockCalibrationOrg(query = "", page = 1, limit = DEFAULT_LIMIT) {
  const currentPage = Number(page) > 0 ? Number(page) : 1;
  const pageSize = Number(limit) > 0 ? Number(limit) : DEFAULT_LIMIT;
  const offset = (currentPage - 1) * pageSize;
  const normalizedQuery = normalize(query);

  const filteredData = normalizedQuery
    ? mockCalibrationOrgs.filter((item) =>
        [
          item.name,
          item.address,
          item.tel,
          item.fax,
          item.contact,
          item.email,
          item.factory,
          item.mobile,
        ].some((value) => normalize(value).includes(normalizedQuery)),
      )
    : mockCalibrationOrgs;

  return {
    data: filteredData.slice(offset, offset + pageSize),
    count: filteredData.length,
    totalPages: Math.ceil(filteredData.length / pageSize),
  };
}

function addMockCalibrationOrg(payload) {
  const name = payload.name?.trim();
  if (!name) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "name is required",
    };
  }

  const duplicated = mockCalibrationOrgs.some(
    (item) => normalize(item.name) === normalize(name),
  );
  if (duplicated) {
    return {
      status: "error",
      code: "DUPLICATE",
      message: "Org already exists",
    };
  }

  const nextId =
    Math.max(0, ...mockCalibrationOrgs.map((item) => Number(item.id))) + 1;
  const newItem = {
    id: nextId,
    ...payload,
    name,
  };
  mockCalibrationOrgs.push(newItem);

  return {
    status: "success",
    message: "Calibration org added successfully (mock)",
    data: { id: newItem.id },
  };
}

function updateMockCalibrationOrg(id, payload) {
  const index = mockCalibrationOrgs.findIndex(
    (item) => String(item.id) === String(id),
  );
  if (index === -1) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Calibration org item not found",
    };
  }

  const name = payload.name?.trim();
  if (!name) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "name is required",
    };
  }

  mockCalibrationOrgs[index] = {
    ...mockCalibrationOrgs[index],
    ...payload,
    name,
  };

  return {
    status: "success",
    message: "Calibration org item updated successfully (mock)",
    data: { id: mockCalibrationOrgs[index].id },
  };
}

function deleteMockCalibrationOrg(id) {
  const beforeLength = mockCalibrationOrgs.length;
  mockCalibrationOrgs = mockCalibrationOrgs.filter(
    (item) => String(item.id) !== String(id),
  );

  if (mockCalibrationOrgs.length === beforeLength) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Calibration org item not found",
    };
  }

  return {
    status: "success",
    message: "Calibration org item deleted successfully (mock)",
  };
}

router.get("/", async (req, res) => {
  const { query, p, limit } = req.query;
  await logAction(`GET /calibration-orgs`, "info", req);
  try {
    const data = isMock
      ? getMockCalibrationOrg(query, p, limit)
      : await getCalibrationOrg(query, p, Number(limit));
    if (!data) {
      await logAction(`No data found`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "資料讀取失敗",
        data: [],
      });
    }

    await logAction(`Found ${data.data?.length ?? 0} items`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration-orgs: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/", upload.none(), async (req, res) => {
  await logAction(`POST /calibration-org`, "info", req);
  try {
    const payload = buildOrgPayload(req.body, req.user);
    const result = isMock
      ? addMockCalibrationOrg(payload)
      : await addCalibrationOrg(payload);

    if (result.status === "error") {
      await logAction(`Error adding item: ${result.message}`, "error", req);
      await logUserAction({
        user: req.user,
        action: "create",
        module: "Calibration",
        detail: JSON.stringify({
          status: "error",
          reason: `${req.body.name} 新增失敗！`,
          error: result.message,
        }),
        req,
      });

      return res.status(500).json(result);
    }
    await logUserAction({
      user: req.user,
      action: "create",
      module: "Calibration",
      detail: JSON.stringify({
        status: "Success",
        reason: `${req.body.name} 新增成功！ id: ${result.data.id}`,
      }),
      req,
    });
    await logAction(`Item added successfully`, "info", req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in POST /calibration-orgs: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/:id", upload.none(), async (req, res) => {
  await logAction(`PUT /calibration-org/${req.params.id}`, "info", req);
  try {
    // Currently no update functionality
    const { id } = req.params;
    const payload = buildOrgPayload(req.body, req.user);
    const result = isMock
      ? updateMockCalibrationOrg(id, payload)
      : await updateCalibrationOrg(id, payload);
    if (result.status === "error") {
      await logAction(`Error updating item: ${result.message}`, "error", req);
      return res.status(500).json(result);
    }

    await logUserAction({
      user: req.user,
      action: "update",
      module: "Calibration",
      detail: JSON.stringify({
        status: "Success",
        reason: `Calibration org item with data: ${id} updated successfully`,
      }),
      req,
    });

    await logAction(`Item updated successfully`, "info", req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration-orgs/${req.params.id}: ${error.message}`,
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
  await logAction(`DELETE /calibration-orgs/${req.params.id}`, "info", req);
  try {
    const { id } = req.params;
    const result = isMock
      ? deleteMockCalibrationOrg(id)
      : await deleteCalibrationOrg(id);
    if (result.status === "error") {
      await logAction(`Error deleting item: ${result.message}`, "error", req);
      return res.status(500).json(result);
    }

    await logUserAction({
      user: req.user,
      action: "delete",
      module: "Calibration",
      detail: JSON.stringify({
        status: "Success",
        reason: `Calibration org item with id: ${id} deleted successfully`,
      }),
      req,
    });

    await logAction(`Item deleted successfully`, "info", req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /calibration-orgs/${req.params.id}: ${error.message}`,
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
