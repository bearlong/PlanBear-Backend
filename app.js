import express from "express";
import * as fs from "fs";
import cookieParser from "cookie-parser";
import cors from "cors";
import createError from "http-errors";
import logger from "morgan";
import path from "path";
import session from "express-session";
import jwt from "jsonwebtoken";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import swaggerJsdoc from "swagger-jsdoc";

// 使用檔案的session store，存在sessions資料夾
import sessionFileStore from "session-file-store";
const FileStore = sessionFileStore(session);

import { fileURLToPath, pathToFileURL } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { extendLog } from "#utils/tool.js";
import "colors";
import { startRetryErrorFlowJob } from "./jobs/retryworkflowError.job.js";
import { scheduleCalibrationAutoNoticeAll } from "./jobs/calibrationAutoNoticeAll.job.js";
import { scheduleCalibrationAutoNoticeBehindtime } from "./jobs/calibrationAutoNoticeBehindtime.jobs.js";
import { scheduleCalibrationAutoNoticeRoom } from "./jobs/calibrationAutoNoticeRoom.jobs.js";
import { scheduleSAPDownCalibration } from "./jobs/SAPDownCalibration.job.js";

// 啟動重試錯誤工作排程
// if (process.env.NODE_ENV === 'production') {
//   console.log('啟動重試錯誤工作排程');
//   startRetryErrorFlowJob();

//   console.log('啟動儀器校驗過期通知工作排程');
//   scheduleCalibrationAutoNoticeAll();
//   scheduleCalibrationAutoNoticeBehindtime();
//   scheduleCalibrationAutoNoticeRoom();
// }
// console.log(
//   '啟動SAP下載校驗工作排程',
//   process.env.FTP_PORT,
//   process.env.FTP_HOST,
//   process.env.FTP_USER
// );
// scheduleSAPDownCalibration();
// extendLog();

// 建立 Express 應用程式
const app = express();

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My API",
      version: "1.0.0",
      description: "這是我的 API 文件",
    },
    servers: [
      {
        url: "http://localhost:3005/api",
      },
    ],
  },
  apis: ["./routes/**/*.js"], // 指定放置 API 註解的檔案
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://localhost:9000",

      "http://workflow.example.com.tw/",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

// 視圖引擎設定
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// 記錄HTTP要求
app.use(logger("dev"));
// 剖析 POST 與 PUT 要求的JSON格式資料
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false, limit: "5mb" }));
// 剖折 Cookie 標頭與增加至 req.cookies
app.use(cookieParser());
// 在 public 的目錄，提供影像、CSS 等靜態檔案
app.use(express.static(path.join(__dirname, "public")));

// fileStore的選項 session-cookie使用
const fileStoreOptions = { logFn: function () {} };
app.use(
  session({
    store: new FileStore(fileStoreOptions), // 使用檔案記錄session
    name: "SESSION_ID", // cookie名稱，儲存在瀏覽器裡
    secret: "67f71af4602195de2450faeb6f8856c0", // 安全字串，應用一個高安全字串
    cookie: {
      maxAge: 30 * 86400000, // 30 * (24 * 60 * 60 * 1000) = 30 * 86400000 => session保存30天
    },
    resave: false,
    saveUninitialized: false,
  }),
);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use(function verifyToken(req, res, next) {
  const exemptedPaths = [
    "/api/login",
    "/api/register",
    "/api/login/MFA",
    "/api/data/files",
    /^\/api\/compare-apply\/[^\/]+\/status$/,
  ];
  console.log(req.path);

  const isExempted = exemptedPaths.some(
    (path) =>
      (typeof path === "string" && path === req.path) || // 靜態路徑匹配
      (path instanceof RegExp && path.test(req.path)), // 動態路徑匹配
  );
  if (isExempted) {
    return next(); // 跳過這個中介層，讓登入 API 可以正常工作
  }
  const token =
    req.cookies.accessToken || req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res
      .status(403)
      .json({ status: "error", data: { message: "Token is missing" } });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        status: "error",
        data: { message: "Token is invalid or expired" },
      });
    }

    req.user = decoded; // 存儲解碼後的用戶資料到請求中
    req.username = decoded.username || "unknown";

    next();
  });
});

// 載入routes中的各路由檔案，並套用api路由 START
const apiPath = "/api"; // 預設路由
const routePath = path.join(__dirname, "routes");
// const filenames = await fs.promises.readdir(routePath);

// for (const filename of filenames) {
//   const item = await import(pathToFileURL(path.join(routePath, filename)));
//   const slug = filename.split('.')[0];
//   app.use(`${apiPath}/${slug === 'index' ? '' : slug}`, item.default);
// }
// 載入routes中的各路由檔案，並套用api路由 END
async function mountRoutes(dir, base = "") {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      // 進子資料夾：/api/<folder>/...
      await mountRoutes(full, `${base}/${e.name}`);
      continue;
    }

    if (!e.isFile() || !e.name.endsWith(".js")) continue;

    const slug = e.name.replace(".js", "");

    // 維持你原本的規則：index.js 代表該層根路由
    const route = slug === "index" ? base || "/" : `${base}/${slug}`;

    const mod = await import(pathToFileURL(full));
    app.use(`${apiPath}${route}`, mod.default);
  }
}

await mountRoutes(routePath);

// 捕抓404錯誤處理
app.use(function (req, res, next) {
  next(createError(404));
});
// API router
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  // 更改為錯誤訊息預設為JSON格式
  res.status(500).send({ error: err });
});

export default app;
