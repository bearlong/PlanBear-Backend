import supabase from "../configs/supabase.js";
import logger from "./logger.js";

/**
 * logUserAction 標準化 action_type 分類參考：
 * - login            : 登入成功
 * - login_failed     : 登入失敗
 * - logout           : 使用者登出
 * - view             : 查閱資料（表單/個資）
 * - create           : 建立新資料
 * - update           : 修改資料
 * - delete           : 刪除資料
 * - import           : 匯入資料
 * - export           : 匯出資料
 * - approve          : 簽核 / 同意行為
 * - reject           : 駁回
 * - mfa_success      : MFA 成功
 * - mfa_failed       : MFA 失敗
 *
 * 你可依照業務需求擴充，但請統一命名、避免亂用。
 */
const isMock = process.env.USE_MOCK === "true";

export async function logUserAction({ user, action, module, detail, req }) {
  const now = new Date();
  const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const newData = {
    username: user.username,
    action_type: action,
    module,
    detail,
    ip_address: req?.ip || "",
    user_agent: req?.headers["user-agent"] || "",
    environment: process.env.NODE_ENV || "unknown",
    created_at: taiwanTime,
  };

  if (isMock) {
    console.log("??Mock logUserAction called");
    console.log(newData);
    return;
  }

  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("user_logs")
    .insert([newData]);

  if (error) {
    logger.error(`Log insert failed: ${error.message}`);
  }
}

export async function logAction(message, level = "info", req, username = null) {
  username = username || req?.user?.username || req?.username || "unknown";
  const fullMessage = `${message} by ${username}`;
  logger.log({ level, message: fullMessage });
}
