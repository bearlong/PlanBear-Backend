import express from "express";
const router = express.Router();
import multer from "multer";
import jwt from "jsonwebtoken";
import "dotenv/config.js";
const upload = multer();
import { logAction, logUserAction } from "../utils/useLogger.js";
import {
  listFactories,
  addUserFactory,
} from "../services/userFactoryService.js";
const isMock = process.env.USE_MOCK === "true";

/**
 * @swagger
 * /user-factory:
 *   get:
 *     summary: Get factory list
 *     tags:
 *       - User Factory
 *     description: Retrieve all available factories for selection.
 *     parameters: []
 *     responses:
 *       200:
 *         description: Success, factory list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Factory list retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       factory:
 *                         type: string
 *                         example: "TAO"
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
 * /user-factory/me:
 *   post:
 *     summary: Set user factory
 *     tags:
 *       - User Factory
 *     description: Bind a factory to the current user (username is decoded from JWT).
 *     parameters:
 *       - in: body
 *         name: body
 *         description: User factory payload.
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             factory:
 *               type: string
 *               example: "TAO"
 *     requestBody:
 *       description: User factory payload (factory).
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - factory
 *             properties:
 *               factory:
 *                 type: string
 *                 example: "TAO"
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - factory
 *             properties:
 *               factory:
 *                 type: string
 *                 example: "TAO"
 *     responses:
 *       201:
 *         description: Success, user factory mapping created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User factory mapping added successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1001
 *       400:
 *         description: Duplicate mapping or invalid request
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

const getMockFactories = () => [
  { factory: "TAO" },
  { factory: "TPE" },
  { factory: "TXG" },
];

router.get("/", async (req, res) => {
  await logAction(`GET /user-factory`, "info", req);
  try {
    if (isMock) {
      console.log("✅ Mock GET /user-factory called");
      const mockData = getMockFactories();
      await logAction(`Mock found ${mockData.length} factories`, "info", req);
      return res.status(200).json({
        status: "success",
        message: "已找到資料 (mock)",
        data: mockData,
      });
    }
    const data = await listFactories();
    if (!data) {
      await logAction(`No data found`, "warn", req);
      return res.status(404).json({
        status: "error",
        message: "資料讀取失敗",
        data: [],
      });
    }

    await logAction(`Found ${data.length} items`, "info", req);
    res.status(200).json({
      status: "success",
      message: "已找到資料",
      data,
    });
  } catch (error) {
    await logAction(
      `Unhandled error in GET /user-factory: ${error.message}`,
      "error",
      req,
    );
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/me", upload.none(), async (req, res) => {
  await logAction(`POST /user-factory`, "info", req);
  try {
    const { factory } = req.body;
    const username = req.user.username;
    const item = { username, factory };
    if (isMock) {
      const secretKey = process.env.JWT_SECRET_KEY;
      const payload = { ...req.user, factory };
      delete payload.exp;
      delete payload.iat;
      const newAccessToken = jwt.sign(payload, secretKey, {
        expiresIn: "10h",
      });

      res.cookie("accessToken", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
      });

      console.log("✅ Mock POST /user-factory called with item:", item);
      await logAction(`Mock adding item: ${JSON.stringify(item)}`, "info", req);

      return res.status(201).json({
        status: "success",
        message: "User factory mapping added successfully (mock)",
        data: { id: 1001 },
      });
    }
    const result = await addUserFactory(item);
    if (result.status === "error") {
      await logAction(`Error adding item: ${result.message}`, "error", req);
      await logUserAction({
        user: req.user,
        action: "create",
        module: "UserFactory",
        detail: JSON.stringify({ item, result }),
      });
      return res.status(400).json(result);
    }
    const secretKey = process.env.JWT_SECRET_KEY;
    const payload = { ...req.user, factory: factory };
    delete payload.exp;
    delete payload.iat;
    const newAccessToken = jwt.sign(payload, secretKey, {
      expiresIn: "10h",
    });

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });

    await logUserAction({
      user: req.user,
      action: "create",
      module: "UserFactory",
      detail: JSON.stringify({ item, result }),
    });
    res.status(201).json(result);
  } catch (error) {
    await logAction(
      `Unhandled error in POST /user-factory: ${error.message}`,
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
