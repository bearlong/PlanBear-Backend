import express from 'express';
const router = express.Router();
import multer from 'multer';
import 'dotenv/config.js';
import { logUserAction, logAction } from '../utils/useLogger.js';

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: User logout
 *     tags:
 *       - User
 *     description: Logs out the currently authenticated user and invalidates the session or token.
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
 *                   example: "登出成功"
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "伺服器錯誤"
 */

const secretKey = process.env.JWT_SECRET_KEY;
const upload = multer();

router.post('/', upload.none(), async (req, res) => {
  await logAction(`[Auth] POST /logout`, 'info', req);
  try {
    await logUserAction({
      user: req.user,
      action: 'logout',
      module: 'Auth',
      detail: JSON.stringify({
        status: 'success',

        reason: '登出成功',
      }),
      req,
    });

    await logAction(
      `[Auth] logout success for ${req.user.username}`,
      'info',
      req
    );
    // 清除 httpOnly cookie
    res.clearCookie('accessToken', {
      httpOnly: true, // 確保是以 httpOnly 標誌清除
      secure: process.env.NODE_ENV === 'production', // 在生產環境中確保 HTTPS
    });

    res.status(200).json({
      status: 'success',
      message: '登出成功',
      data: {
        user: undefined,
      },
    });
  } catch (error) {
    await logUserAction({
      user: req.user,
      action: 'logout',
      module: 'Auth',
      detail: JSON.stringify({
        status: 'error',
        reason: '伺服器錯誤',
      }),
      req,
    });

    await logAction(`[Auth] logout failed`, 'error', req);
    // 處理錯誤
    res.status(500).json({ status: 'error', message: '伺服器錯誤' });
  }
});

export default router;
