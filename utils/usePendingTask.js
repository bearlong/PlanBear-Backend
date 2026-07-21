import supabase from "../configs/supabase.js";
import { logAction } from "../utils/useLogger.js";

// ========================================================================
// Pending Task  說明文件
// ========================================================================
//
// 用途：
//   統一管理「待辦事項 (pending_task)」相關的資料庫操作邏輯。
//   提供查詢、建立、完成(更新)待辦等基本介面，供後端路由或其他模組呼叫。
//
// 📂 使用資料表：
//   Schema: process.env.DB_SCHEMA
//   Table: pending_task
//
// 📊 欄位說明：
//   id               - 流水號
//   created_at       - 建立時間（由系統自動產生）
//   done_date        - 完成時間
//   username         - 待辦負責人（員編）
//   model            - 所屬模組名稱（如 Vendor Compare Price）
//   ref_id           - 模組中對應的單號/識別值
//   title            - 顯示在待辦清單上的標題
//   memo             - 待辦原因/摘要/備註
//   url              - 前端跳轉路徑
//   is_finished      - 是否已完成 (boolean)
// ------------------------------------------------------------------------
//
//
// 🧩 提供的主要函式：
// 1️⃣ getPendingTasks(username)
//    ▶ 依據使用者查詢所有未完成的待辦事項
//    ▶ 回傳時會將 created_at 轉為 YYYY/MM/DD HH:mm:ss 格式
//    ▶ 同時查詢 b_user 資料表取得顯示姓名 (ename + fullname)
//
// 2️⃣ addPendingTasks(username, model, ref_id, title, memo, url)
//    ▶ 新增一筆待辦事項
//    ▶ created_at 自動填入系統時間
//    ▶ is_finished 預設 false
//
// 3️⃣ finishPendingTask(username, ref_id)
//    ▶ 將待辦改為完成 (is_finished = true)
//    ▶ 設定完成時間 done_date = 系統時間
//    ▶ 僅更新尚未完成的紀錄（避免重複更新）
//
// ------------------------------------------------------------------------
// 🧩 格式化工具：
//
// formatDateRaw(d)
//   ▶ 將 datetime 轉換為：YYYY/MM/DD HH:mm:ss
//   ▶ 用於將 DB 取出的 created_at 格式化後回傳給前端顯示
//
// ------------------------------------------------------------------------
// 🚀 設計理念：
//
// ✔ 各模組僅需呼叫 addPendingTasks() 即可寫入待辦
// ✔ 前端只要呼叫 getPendingTasks() 即可取得資料並顯示
// ✔ 簽核完成或流程結案時呼叫 finishPendingTask() 即可更新狀態
//
// ========================================================================
// 此屬通用 Service，供不同模組集中管理 Pending Task 邏輯
// ========================================================================
export async function getPendingTasks(username) {
  try {
    let pendingTaskQuery = supabase
      .schema(process.env.DB_SCHEMA)
      .from("pending_task")
      .select("id, created_at, username, model, ref_id, title, memo, url")
      .eq("username", username)
      .eq("is_finished", false)
      .order("created_at", { ascending: true });
    const { data, error } = await pendingTaskQuery;

    if (error) throw error; // 抛出錯誤

    const safeData = data ?? [];
    let userQuery = supabase
      .schema(process.env.DB_SCHEMA)
      .from("b_user")
      .select("ename, fullname")
      .eq("username", username)
      .single();
    const { data: userData, error: userError } = await userQuery;
    if (userError) throw userError; // 抛出錯誤
    const user_displayname = userData
      ? `${userData.ename} ${userData.fullname}`
      : username;

    const formatted = safeData.map((item) => ({
      ...item,
      user_displayname,
      create_date: formatDateRaw(item.created_at),
    }));
    return formatted;
  } catch (err) {
    console.error("Error fetching pending tasks:", err);
    throw new Error(err.message);
  }
}

function formatDateRaw(d) {
  const date = new Date(d);
  const pad = (n) => n.toString().padStart(2, "0");

  const Y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());

  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
}

export async function addPendingTasks(
  username,
  model,
  ref_id,
  title,
  memo,
  url,
) {
  try {
    const newData = {
      created_at: new Date(),
      username,
      model,
      ref_id,
      title,
      memo,
      url,
      is_finished: false,
    };

    const { error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("pending_task")
      .insert([newData]);

    if (error) throw error; // 抛出錯誤
  } catch (err) {
    console.error("Error fetching pending tasks:", err);
    throw new Error(err.message);
  }
}

export async function finishPendingTask(username, ref_id) {
  try {
    console.log("finishPendingTask called with:", username, ref_id);

    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("pending_task")
      .update({ is_finished: true, done_date: new Date() })
      .eq("username", username)
      .eq("ref_id", ref_id)
      .eq("is_finished", false);
    if (error) throw error; // 抛出錯誤

    if (!data || data.length === 0) {
      console.warn("No pending task updated for", { username, ref_id });
    }
  } catch (err) {
    console.error("Error finishing pending tasks:", err);
    throw new Error(err.message);
  }
}
