import express from 'express';
const router = express.Router();
import 'dotenv/config.js';
import { logAction } from '../../utils/useLogger.js';
import { getInstrumentSystems } from '../../services/calibration/instrumentSystemService.js';

const isMock = process.env.USE_MOCK === 'true';

const getMockInstrumentSystems = () => [
  {
    system_name: 'QA',
    description: 'Quality Assurance',
  },
  {
    system_name: 'Production',
    description: 'Production line instruments',
  },
  {
    system_name: 'Engineering',
    description: 'Engineering validation instruments',
  },
];

/**
 * @swagger
 * /Calibration/instrument-systems:
 *   get:
 *     summary: Get instrument systems
 *     tags:
 *       - Calibration
 *     description: Retrieve available instrument systems that are not deleted.
 *     parameters: []
 *     responses:
 *       200:
 *         description: Success, instrument systems retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Instrument systems retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       system_name:
 *                         type: string
 *                         example: "QA"
 *                       description:
 *                         type: string
 *                         example: "Quality Assurance"
 *       404:
 *         description: No systems found
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
 */

router.get('/', async (req, res) => {
  await logAction(`GET /instrument-systems`, 'info', req);
  try {
    if (isMock) {
      const data = getMockInstrumentSystems();
      await logAction(`Mock found ${data.length} systems`, 'info', req);
      return res.status(200).json({
        status: 'success',
        message: 'Instrument systems retrieved successfully (mock)',
        data,
      });
    }

    const data = await getInstrumentSystems();
    if (!data) {
      await logAction(`No systems found`, 'warn', req);
      return res.status(404).json({
        status: 'error',
        message: '資料讀取失敗',
        data: [],
      });
    }

    await logAction(`Found ${data.length} systems`, 'info', req);
    res.status(200).json({
      status: 'success',
      message: '已找到資料',
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /instrument-systems: ${error.message}`,
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
