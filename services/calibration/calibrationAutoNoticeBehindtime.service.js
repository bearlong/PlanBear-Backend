import { getAutoNoticeBehindtime } from "../../repositories/calibration/calibration.repo.js";
import {
  getInfoByUsernames,
  getUserByUsernames,
} from "../../repositories/user.repo.js";
import { sendNotificationMail } from "../../utils/useMail.js";

async function enrichOwners(rows) {
  // 1) 抽出所有 owner_username（去重）
  const usernames = [
    ...new Set(rows.map((r) => r.owner_username).filter(Boolean)),
  ];

  // 2) 批次查 user 資料
  const users = usernames.length > 0 ? await getUserByUsernames(usernames) : [];

  // 3) 建 map：username -> displayName（依你的 user 欄位調整）
  const userMap = new Map(
    users.map((u) => [u.username, u.fullname ?? u.name ?? u.Username]),
  );

  // 4) 回填 owner：有 username 就用查到的名字，查不到就 fallback；沒 username 就用原本 owner
  return rows.map((r) => {
    const nameFromUser = r.owner_username
      ? userMap.get(r.owner_username)
      : null;

    return {
      ...r,
      owner: nameFromUser ?? r.owner ?? null,
    };
  });
}

function buildAutoNoticeMail(item) {
  const { due_date, property_no, instrument, owner, dept, calibr_cycle } = item;
  const today = new Date();
  const dueDate = new Date(due_date);
  const delayDays = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
  const subject = `儀器校驗 逾期未校停用 . 部門 : ${dept} , 儀器名稱: ${instrument?.instru_name} , 保管人: ${owner} , 逾期天數: ${delayDays} 天 !`;

  const html = `
    <p>Dear Sir/Madam,</p>

    <p>財產編號: ${property_no}尚未完成校驗且已逾期 ${delayDays} 天，請協助確認並盡快處理。</p>

    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px;">
      <thead>
        <tr>
    <th style="background:#0d5cab;color:#ffffff;">應送校驗日期</th>
        <th style="background:#0d5cab;color:#ffffff;">財產編號</th>
        <th style="background:#0d5cab;color:#ffffff;">儀器類別</th>
        <th style="background:#0d5cab;color:#ffffff;">儀器名稱</th>
        <th style="background:#0d5cab;color:#ffffff;">保管人</th>
        <th style="background:#0d5cab;color:#ffffff;">部門</th>
        <th style="background:#0d5cab;color:#ffffff;">送校週期</th>
        </tr>
      </thead>
      <tbody>
             <tr>
          <td>${due_date}</td>
          <td>${property_no || ""}</td>
          <td>${instrument?.system || ""}</td>
          <td>${instrument?.instru_name || ""}</td>
          <td>${owner || ""}</td>
          <td>${dept || ""}</td>
          <td>${calibr_cycle || ""} 個月</td>
        </tr>
      </tbody>
    </table>

    <p>此信件由系統自動發送，請勿直接回覆。</p>
  `;
  return { subject, html };
}

export async function calibrationAutoNoticeBehindtime() {
  const datas = await getAutoNoticeBehindtime();
  const enrichedDatas = await enrichOwners(datas);

  for (const data of enrichedDatas) {
    const RECIPIENT_USERNAME = "calibration_admin";
    const users = await getInfoByUsernames(
      [RECIPIENT_USERNAME],
      "username,email",
    );
    const recipientEmail = users[0]?.email;

    const { subject, html } = buildAutoNoticeMail(data);
    const mailOptions = {
      recipientEmail: recipientEmail,
      ccEmails: recipientEmail,
      subject,
      html,
    };
    await sendNotificationMail(mailOptions);
  }
}
