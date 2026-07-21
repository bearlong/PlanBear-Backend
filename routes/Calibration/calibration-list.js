import express from 'express';
const router = express.Router();
import multer from 'multer';
import 'dotenv/config.js';
const upload = multer();
import { logAction, logUserAction } from '../../utils/useLogger.js';
import {
  getCalibrationLists,
  addCalibrationLists,
  updateCalibrationList,
  deleteCalibrationList,
} from '../../services/calibration/calibrationListService.js';

const isMock = process.env.USE_MOCK === 'true';
const DEFAULT_LIMIT = 20;

let mockCalibrationLists = [
  {
    id: 1,
    instru_name: 'Micrometer',
    system: 'QA',
  },
  {
    id: 2,
    instru_name: 'Caliper',
    system: 'QA',
  },
  {
    id: 3,
    instru_name: 'Torque Wrench',
    system: 'Production',
  },
  {
    id: 4,
    instru_name: 'Digital Multimeter',
    system: 'Engineering',
  },
];

const emptyStringToNull = (obj) => {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === 'string' && out[key].trim() === '') {
      out[key] = null;
    }
  }
  return out;
};

const normalize = (value) => value?.toString().trim().toLowerCase() ?? '';

function getMockCalibrationLists(query = '', system = '', page = 1) {
  const currentPage = Number(page) > 0 ? Number(page) : 1;
  const offset = (currentPage - 1) * DEFAULT_LIMIT;
  const normalizedQuery = normalize(query);
  const normalizedSystem = normalize(system);

  const filteredData = mockCalibrationLists.filter((item) => {
    const queryMatch =
      !normalizedQuery || normalize(item.instru_name).includes(normalizedQuery);
    const systemMatch =
      !normalizedSystem || normalize(item.system) === normalizedSystem;
    return queryMatch && systemMatch;
  });

  return {
    data: filteredData.slice(offset, offset + DEFAULT_LIMIT),
    count: filteredData.length,
    totalPages: Math.ceil(filteredData.length / DEFAULT_LIMIT),
  };
}

function addMockCalibrationList(payload) {
  const instruName = payload.instru_name?.trim();
  const system = payload.system?.trim();

  if (!instruName || !system) {
    return {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'instru_name and system are required',
    };
  }

  const duplicated = mockCalibrationLists.some(
    (item) => normalize(item.instru_name) === normalize(instruName)
  );
  if (duplicated) {
    return {
      status: 'error',
      code: 'DUPLICATE',
      message: 'Instrument already exists',
    };
  }

  const nextId =
    Math.max(0, ...mockCalibrationLists.map((item) => Number(item.id))) + 1;
  const newItem = {
    id: nextId,
    instru_name: instruName,
    system,
  };
  mockCalibrationLists.push(newItem);

  return {
    status: 'success',
    message: 'Instrument system added successfully (mock)',
    data: { id: newItem.id },
  };
}

function updateMockCalibrationList(id, payload) {
  const index = mockCalibrationLists.findIndex(
    (item) => String(item.id) === String(id)
  );
  if (index === -1) {
    return {
      status: 'error',
      code: 'NOT_FOUND',
      message: 'Calibration list item not found',
    };
  }

  const nextItem = {
    ...mockCalibrationLists[index],
    ...payload,
  };

  if (!nextItem.instru_name || !nextItem.system) {
    return {
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'instru_name and system are required',
    };
  }

  mockCalibrationLists[index] = nextItem;

  return {
    status: 'success',
    message: 'Calibration list item updated successfully (mock)',
    data: { id: nextItem.id },
  };
}

function deleteMockCalibrationList(id) {
  const beforeLength = mockCalibrationLists.length;
  mockCalibrationLists = mockCalibrationLists.filter(
    (item) => String(item.id) !== String(id)
  );

  if (mockCalibrationLists.length === beforeLength) {
    return {
      status: 'error',
      code: 'NOT_FOUND',
      message: 'Calibration list item not found',
    };
  }

  return {
    status: 'success',
    message: 'Calibration list item deleted successfully (mock)',
  };
}

/**
 * @swagger
 * /Calibration/calibration-list:
 *   get:
 *     summary: Get calibration list
 *     tags:
 *       - Calibration
 *     description: Retrieve calibration instrument list with optional filters and pagination.
 *     parameters:
 *       - in: query
 *         name: query
 *         description: Search term to filter by instrument name.
 *         required: false
 *         schema:
 *           type: string
 *           example: "Micrometer"
 *       - in: query
 *         name: system
 *         description: Filter by system name.
 *         required: false
 *         schema:
 *           type: string
 *           example: "QA"
 *       - in: query
 *         name: p
 *         description: Page number for pagination.
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Success, calibration list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Calibration list retrieved successfully"
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
 *                           instru_name:
 *                             type: string
 *                             example: "Micrometer"
 *                           system:
 *                             type: string
 *                             example: "QA"
 *                     count:
 *                       type: integer
 *                       example: 40
 *                     totalPages:
 *                       type: integer
 *                       example: 2
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
 *     summary: Add calibration list item
 *     tags:
 *       - Calibration
 *     description: Create a calibration list item.
 *     parameters:
 *       - in: body
 *         name: body
 *         description: Calibration list payload.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             instru_name:
 *               type: string
 *               example: "Micrometer"
 *             system:
 *               type: string
 *               example: "QA"
 *     requestBody:
 *       description: Calibration list payload (instru_name, system).
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - instru_name
 *               - system
 *             properties:
 *               instru_name:
 *                 type: string
 *                 example: "Micrometer"
 *               system:
 *                 type: string
 *                 example: "QA"
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - instru_name
 *               - system
 *             properties:
 *               instru_name:
 *                 type: string
 *                 example: "Micrometer"
 *               system:
 *                 type: string
 *                 example: "QA"
 *     responses:
 *       200:
 *         description: Success, calibration list item created
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
 *                       example: 101
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
 *                   example: "Instrument already exists"
 * /Calibration/calibration-list/{id}:
 *   put:
 *     summary: Update calibration list item
 *     tags:
 *       - Calibration
 *     description: Update a calibration list item by id.
 *     parameters:
 *       - in: path
 *         name: id
 *         description: Calibration list item id.
 *         required: true
 *         schema:
 *           type: integer
 *           example: 101
 *       - in: body
 *         name: body
 *         description: Calibration list payload.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             instru_name:
 *               type: string
 *               example: "Micrometer"
 *             system:
 *               type: string
 *               example: "QA"
 *     requestBody:
 *       description: Calibration list payload (instru_name, system).
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - instru_name
 *               - system
 *             properties:
 *               instru_name:
 *                 type: string
 *                 example: "Micrometer"
 *               system:
 *                 type: string
 *                 example: "QA"
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - instru_name
 *               - system
 *             properties:
 *               instru_name:
 *                 type: string
 *                 example: "Micrometer"
 *               system:
 *                 type: string
 *                 example: "QA"
 *     responses:
 *       200:
 *         description: Success, calibration list item updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Calibration list item updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 101
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
 *     summary: Delete calibration list item
 *     tags:
 *       - Calibration
 *     description: Delete a calibration list item by id.
 *     parameters:
 *       - in: path
 *         name: id
 *         description: Calibration list item id.
 *         required: true
 *         schema:
 *           type: integer
 *           example: 101
 *     responses:
 *       200:
 *         description: Success, calibration list item deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Calibration list item deleted successfully"
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

router.get('/', async (req, res) => {
  const { query, system, p } = req.query;
  await logAction(`GET /calibration-list`, 'info', req);
  try {
    if (isMock) {
      const data = getMockCalibrationLists(query, system, p);
      await logAction(
        `Mock found ${data.data.length} calibration-list items`,
        'info',
        req
      );
      return res.status(200).json({
        status: 'success',
        message: 'Calibration list retrieved successfully (mock)',
        data,
      });
    }

    const data = await getCalibrationLists(query, system, p);
    if (!data) {
      await logAction(`No data found`, 'warn', req);
      return res.status(404).json({
        status: 'error',
        message: '資料讀取失敗',
        data: [],
      });
    }

    await logAction(`Found ${data.data?.length ?? 0} items`, 'info', req);
    res.status(200).json({
      status: 'success',
      message: '已找到資料',
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /calibration-list: ${error.message}`,
      'error',
      req
    );
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

router.post('/', upload.none(), async (req, res) => {
  await logAction(`POST /calibration-list`, 'info', req);
  try {
    const payload = emptyStringToNull(req.body);
    const { instru_name, system } = payload;
    const result = isMock
      ? addMockCalibrationList(payload)
      : await addCalibrationLists(instru_name, system);

    if (result.status === 'error') {
      await logAction(`Error adding item: ${result.message}`, 'error', req);
      await logUserAction({
        user: req.user,
        action: 'create',
        module: 'Calibration',
        detail: JSON.stringify({
          status: 'error',
          reason: `${instru_name} 新增失敗！`,
          error: result.message,
        }),
        req,
      });

      return res.status(500).json(result);
    }
    await logUserAction({
      user: req.user,
      action: 'create',
      module: 'Calibration',
      detail: JSON.stringify({
        status: 'Success',
        reason: `${instru_name} 新增成功！ id: ${result.data.id}`,
      }),
      req,
    });
    await logAction(`Item added successfully`, 'info', req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in POST /calibration-list: ${error.message}`,
      'error',
      req
    );
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

router.put('/:id', upload.none(), async (req, res) => {
  await logAction(`PUT /calibration-list/${req.params.id}`, 'info', req);
  try {
    const { id } = req.params;
    const payload = emptyStringToNull(req.body);
    const { instru_name, system } = payload;
    const result = isMock
      ? updateMockCalibrationList(id, payload)
      : await updateCalibrationList(id, instru_name, system);
    if (result.status === 'error') {
      await logAction(`Error updating item: ${result.message}`, 'error', req);
      return res.status(500).json(result);
    }

    await logUserAction({
      user: req.user,
      action: 'update',
      module: 'Calibration',
      detail: JSON.stringify({
        status: 'Success',
        reason: `Calibration list item with data: ${id} updated successfully`,
      }),
      req,
    });

    await logAction(`Item updated successfully`, 'info', req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in PUT /calibration-list/${req.params.id}: ${error.message}`,
      'error',
      req
    );
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

router.delete('/:id', async (req, res) => {
  await logAction(`DELETE /calibration-list/${req.params.id}`, 'info', req);
  try {
    const { id } = req.params;
    const result = isMock
      ? deleteMockCalibrationList(id)
      : await deleteCalibrationList(id);
    if (result.status === 'error') {
      await logAction(`Error deleting item: ${result.message}`, 'error', req);
      return res.status(500).json(result);
    }

    await logUserAction({
      user: req.user,
      action: 'delete',
      module: 'Calibration',
      detail: JSON.stringify({
        status: 'Success',
        reason: `Calibration list item with id: ${id} deleted successfully`,
      }),
      req,
    });

    await logAction(`Item deleted successfully`, 'info', req);
    res.status(200).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in DELETE /calibration-list/${req.params.id}: ${error.message}`,
      'error',
      req
    );
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
