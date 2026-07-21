import express from "express";
const router = express.Router();
import multer from "multer";
import "dotenv/config.js";
const upload = multer();

import { logAction, logUserAction } from "../../utils/useLogger.js";
import {
  getNoticeMemberList,
  addNoticeMember,
  editNoticeMember,
  removeNoticeMember,
  batchEditNoticeMember,
  batchRemoveNoticeMember,
} from "../../services/calibration/noticeMemberListService.js";

const isMock = process.env.USE_MOCK === "true";
const DEFAULT_LIMIT = 20;

let mockNoticeMembers = [
  {
    id: 1,
    username: "8892",
    name: "Bear Shen",
    dept: "QA",
    factory: "TAO",
    use_level: "1",
    cc: true,
  },
  {
    id: 2,
    username: "60340",
    name: "大強",
    dept: "Procurement",
    factory: "TAO",
    use_level: "0",
    cc: false,
  },
  {
    id: 3,
    username: "7125",
    name: "王小明",
    dept: "Engineering",
    factory: "TPE",
    use_level: "1",
    cc: true,
  },
];

/**
 * @swagger
 * /Calibration/notice-member-list:
 *   get:
 *     summary: Get notice member list
 *     tags:
 *       - Calibration
 *     description: Retrieve notice members for calibration notifications.
 *     parameters:
 *       - in: query
 *         name: query
 *         description: Search term to filter by name or username.
 *         required: false
 *         schema:
 *           type: string
 *           example: "8892"
 *       - in: query
 *         name: factory
 *         description: Filter by factory.
 *         required: false
 *         schema:
 *           type: string
 *           example: "TAO"
 *       - in: query
 *         name: dept
 *         description: Filter by department.
 *         required: false
 *         schema:
 *           type: string
 *           example: "QA"
 *       - in: query
 *         name: use_level
 *         description: Filter by use level.
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: cc
 *         description: Filter by CC flag.
 *         required: false
 *         schema:
 *           type: boolean
 *           example: true
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
 *         description: Success, notice members retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Notice members fetched successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       username:
 *                         type: string
 *                         example: "8892"
 *                       name:
 *                         type: string
 *                         example: "Bear Shen"
 *                       dept:
 *                         type: string
 *                         example: "QA"
 *                       factory:
 *                         type: string
 *                         example: "TAO"
 *                       use_level:
 *                         type: integer
 *                         example: 1
 *                       cc:
 *                         type: boolean
 *                         example: true
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
 *     summary: Add notice member
 *     tags:
 *       - Calibration
 *     description: Create a notice member for calibration notifications.
 *     parameters:
 *       - in: body
 *         name: body
 *         description: Notice member payload.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *               example: "8892"
 *             name:
 *               type: string
 *               example: "Bear Shen"
 *             dept:
 *               type: string
 *               example: "QA"
 *             factory:
 *               type: string
 *               example: "TAO"
 *             use_level:
 *               type: integer
 *               example: 1
 *             cc:
 *               type: boolean
 *               example: false
 *     requestBody:
 *       description: Notice member payload.
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 example: "8892"
 *               name:
 *                 type: string
 *                 example: "Bear Shen"
 *               dept:
 *                 type: string
 *                 example: "QA"
 *               factory:
 *                 type: string
 *                 example: "TAO"
 *               use_level:
 *                 type: integer
 *                 example: 1
 *               cc:
 *                 type: boolean
 *                 example: false
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 example: "8892"
 *               name:
 *                 type: string
 *                 example: "Bear Shen"
 *               dept:
 *                 type: string
 *                 example: "QA"
 *               factory:
 *                 type: string
 *                 example: "TAO"
 *               use_level:
 *                 type: integer
 *                 example: 1
 *               cc:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Success, notice member created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Notice member added successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 3001
 *       409:
 *         description: Duplicate notice member
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
 *                   example: "Notice member already exists"
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
 * /Calibration/notice-member-list/batch:
 *   put:
 *     summary: Batch update notice members
 *     tags:
 *       - Calibration
 *     description: Batch update or insert notice members.
 *     parameters:
 *       - in: body
 *         name: body
 *         description: Array of notice member payloads with id.
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 3001
 *               name:
 *                 type: string
 *                 example: "Bear Shen"
 *               dept:
 *                 type: string
 *                 example: "QA"
 *               factory:
 *                 type: string
 *                 example: "TAO"
 *               use_level:
 *                 type: integer
 *                 example: 1
 *               cc:
 *                 type: boolean
 *                 example: false
 *     requestBody:
 *       description: Batch payload (array of notice member items).
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 3001
 *                 name:
 *                   type: string
 *                   example: "Bear Shen"
 *                 dept:
 *                   type: string
 *                   example: "QA"
 *                 factory:
 *                   type: string
 *                   example: "TAO"
 *                 use_level:
 *                   type: integer
 *                   example: 1
 *                 cc:
 *                   type: boolean
 *                   example: false
 *     responses:
 *       200:
 *         description: Success, batch processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Batch notice members processed successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 3001
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
 *     summary: Batch delete notice members
 *     tags:
 *       - Calibration
 *     description: Delete notice members by id list.
 *     parameters:
 *       - in: body
 *         name: body
 *         description: Array of notice member ids.
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *             example: 3001
 *     requestBody:
 *       description: Array of notice member ids.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: integer
 *               example: 3001
 *     responses:
 *       200:
 *         description: Success, batch deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Notice members deleted successfully"
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
 * /Calibration/notice-member-list/{id}:
 *   put:
 *     summary: Update notice member
 *     tags:
 *       - Calibration
 *     description: Update a notice member by id.
 *     parameters:
 *       - in: path
 *         name: id
 *         description: Notice member id.
 *         required: true
 *         schema:
 *           type: integer
 *           example: 3001
 *       - in: body
 *         name: body
 *         description: Notice member payload.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "Bear Shen"
 *             dept:
 *               type: string
 *               example: "QA"
 *             factory:
 *               type: string
 *               example: "TAO"
 *             use_level:
 *               type: integer
 *               example: 1
 *             cc:
 *               type: boolean
 *               example: true
 *     requestBody:
 *       description: Notice member payload.
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Bear Shen"
 *               dept:
 *                 type: string
 *                 example: "QA"
 *               factory:
 *                 type: string
 *                 example: "TAO"
 *               use_level:
 *                 type: integer
 *                 example: 1
 *               cc:
 *                 type: boolean
 *                 example: true
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Bear Shen"
 *               dept:
 *                 type: string
 *                 example: "QA"
 *               factory:
 *                 type: string
 *                 example: "TAO"
 *               use_level:
 *                 type: integer
 *                 example: 1
 *               cc:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Success, notice member updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Notice member updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 3001
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
 *     summary: Delete notice member
 *     tags:
 *       - Calibration
 *     description: Delete a notice member by id.
 *     parameters:
 *       - in: path
 *         name: id
 *         description: Notice member id.
 *         required: true
 *         schema:
 *           type: integer
 *           example: 3001
 *     responses:
 *       200:
 *         description: Success, notice member deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Notice member deleted successfully"
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

const parseBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
};

const normalizePayload = (payload) => {
  const out = emptyStringToNull(payload);
  if (Object.prototype.hasOwnProperty.call(out, "cc")) {
    out.cc = parseBoolean(out.cc);
  }
  return out;
};

const normalizeText = (value) => value?.toString().trim().toLowerCase() ?? "";

const normalizeNoticeMember = (payload) => {
  const out = normalizePayload(payload);
  if (Object.prototype.hasOwnProperty.call(out, "use_level")) {
    out.use_level =
      out.use_level === null || out.use_level === undefined
        ? null
        : Number(out.use_level);
  }
  return out;
};

function getMockNoticeMemberList(filters = {}) {
  const {
    query = "",
    factory = "",
    dept = "",
    use_level,
    cc,
    p = 1,
    limit = DEFAULT_LIMIT,
  } = filters;
  const currentPage = Number(p) > 0 ? Number(p) : 1;
  const pageSize = Number(limit) > 0 ? Number(limit) : DEFAULT_LIMIT;
  const offset = (currentPage - 1) * pageSize;
  const normalizedQuery = normalizeText(query);
  const normalizedFactory = normalizeText(factory);
  const normalizedDept = normalizeText(dept);
  const normalizedCc = parseBoolean(cc);
  const normalizedUseLevel =
    use_level === undefined || use_level === null || use_level === ""
      ? undefined
      : Number(use_level);

  const filteredData = mockNoticeMembers.filter((item) => {
    const queryMatch =
      !normalizedQuery ||
      normalizeText(item.username).includes(normalizedQuery) ||
      normalizeText(item.name).includes(normalizedQuery);
    const factoryMatch =
      !normalizedFactory || normalizeText(item.factory) === normalizedFactory;
    const deptMatch =
      !normalizedDept || normalizeText(item.dept) === normalizedDept;
    const useLevelMatch =
      normalizedUseLevel === undefined ||
      Number(item.use_level) === normalizedUseLevel;
    const ccMatch = normalizedCc === undefined || item.cc === normalizedCc;

    return queryMatch && factoryMatch && deptMatch && useLevelMatch && ccMatch;
  });

  return filteredData.slice(offset, offset + pageSize);
}

function addMockNoticeMember(payload) {
  const item = normalizeNoticeMember(payload);
  if (!item.username) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "username is required",
    };
  }

  const duplicated = mockNoticeMembers.some(
    (member) =>
      normalizeText(member.username) === normalizeText(item.username) &&
      normalizeText(member.factory) === normalizeText(item.factory) &&
      normalizeText(member.dept) === normalizeText(item.dept) &&
      Number(member.use_level) === Number(item.use_level),
  );
  if (duplicated) {
    return {
      status: "error",
      code: "DUPLICATE",
      message: "Notice member already exists",
    };
  }

  const nextId = Math.max(0, ...mockNoticeMembers.map((m) => Number(m.id))) + 1;
  const newItem = {
    id: nextId,
    username: item.username,
    name: item.name,
    dept: item.dept,
    factory: item.factory,
    use_level: item.use_level,
    cc: item.cc ?? false,
  };
  mockNoticeMembers.push(newItem);

  return {
    status: "success",
    message: "Notice member added successfully (mock)",
    data: newItem,
  };
}

function editMockNoticeMember(id, payload) {
  const index = mockNoticeMembers.findIndex(
    (member) => String(member.id) === String(id),
  );
  if (index === -1) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Notice member not found",
    };
  }

  const item = normalizeNoticeMember(payload);
  mockNoticeMembers[index] = {
    ...mockNoticeMembers[index],
    ...item,
  };

  return {
    status: "success",
    message: "Notice member updated successfully (mock)",
    data: mockNoticeMembers[index],
  };
}

function batchEditMockNoticeMember(items) {
  return items.map((item) => {
    const { id, ...payload } = item;
    if (id) {
      return editMockNoticeMember(id, payload).data;
    }
    return addMockNoticeMember(payload).data;
  });
}

function removeMockNoticeMember(id) {
  const beforeLength = mockNoticeMembers.length;
  mockNoticeMembers = mockNoticeMembers.filter(
    (member) => String(member.id) !== String(id),
  );
  if (mockNoticeMembers.length === beforeLength) {
    return {
      status: "error",
      code: "NOT_FOUND",
      message: "Notice member not found",
    };
  }

  return {
    status: "success",
    message: "Notice member deleted successfully (mock)",
  };
}

function batchRemoveMockNoticeMember(items) {
  const idSet = new Set(items.map((id) => String(id)));
  mockNoticeMembers = mockNoticeMembers.filter(
    (member) => !idSet.has(String(member.id)),
  );

  return {
    status: "success",
    message: "Notice members deleted successfully (mock)",
  };
}

router.get("/", async (req, res) => {
  const { query, factory, dept, use_level, cc, p, limit } = req.query;
  await logAction(`GET /notice-member-list`, "info", req);
  try {
    if (isMock) {
      const data = getMockNoticeMemberList({
        query,
        factory,
        dept,
        use_level,
        cc,
        p,
        limit,
      });
      await logAction(`Mock found ${data.length} notice members`, "info", req);
      return res.status(200).json({
        status: "success",
        message: "Notice members fetched successfully (mock)",
        data,
      });
    }

    const data = await getNoticeMemberList();

    res.status(200).json({
      status: "success",
      message: "Notice members fetched successfully",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /notice-member-list: ${error.message}`,
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
  await logAction(`POST /notice-member-list`, "info", req);
  try {
    const payload = normalizePayload(req.body);
    const result = isMock
      ? addMockNoticeMember(payload)
      : await addNoticeMember(payload);
    if (result.status === "error") {
      await logAction(`Error adding item: ${result.message}`, "error", req);
      await logUserAction({
        user: req.user,
        action: "create",
        module: "Calibration",
        detail: JSON.stringify({
          status: "error",
          reason: `Create notice member failed`,
          error: result.message,
        }),
        req,
      });
      return res.status(409).json(result);
    }

    await logUserAction({
      user: req.user,
      action: "create",
      module: "Calibration",
      detail: JSON.stringify({
        status: "Success",
        reason: `Notice member created with id: ${result.data.id}`,
      }),
      req,
    });
    await logAction(`Item added successfully`, "info", req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in POST /notice-member-list: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.put("/batch", upload.none(), async (req, res) => {
  await logAction(`PUT /notice-member-list/batch`, "info", req);
  try {
    const items = Array.isArray(req.body) ? req.body : [];

    const result = isMock
      ? batchEditMockNoticeMember(items)
      : await batchEditNoticeMember(items);
    await logUserAction({
      user: req.user,
      action: "update",
      module: "Calibration",
      detail: JSON.stringify({
        status: "Success",
        reason: `Batch notice member update/insert completed successfully`,
      }),
      req,
    });

    await logAction(`Batch items processed successfully`, "info", req);
    res.status(200).json({
      status: "success",
      message: "Batch notice members processed successfully",
      data: result,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /notice-member-list/batch: ${error.message}`,
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
  await logAction(`PUT /notice-member-list/${req.params.id}`, "info", req);
  try {
    const { id } = req.params;
    const payload = normalizePayload(req.body);
    const result = isMock
      ? editMockNoticeMember(id, payload)
      : await editNoticeMember(id, payload);
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
        reason: `Notice member with id ${id} updated successfully`,
      }),
      req,
    });

    await logAction(`Item updated successfully`, "info", req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /notice-member-list/${req.params.id}: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.delete("/batch", upload.none(), async (req, res) => {
  await logAction(`DELETE /notice-member-list/batch`, "info", req);
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    const result = isMock
      ? batchRemoveMockNoticeMember(items)
      : await batchRemoveNoticeMember(items);

    await logUserAction({
      user: req.user,
      action: "delete",
      module: "Calibration",
      detail: JSON.stringify({
        status: "Success",
        reason: `Batch notice member deletion completed successfully`,
      }),
      req,
    });

    await logAction(`Batch items deleted successfully`, "info", req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /notice-member-list/batch: ${error.message}`,
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
  await logAction(`DELETE /notice-member-list/${req.params.id}`, "info", req);
  try {
    const { id } = req.params;
    const result = isMock
      ? removeMockNoticeMember(id)
      : await removeNoticeMember(id);
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
        reason: `Notice member with id ${id} deleted successfully`,
      }),
      req,
    });

    await logAction(`Item deleted successfully`, "info", req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /notice-member-list/${req.params.id}: ${error.message}`,
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
