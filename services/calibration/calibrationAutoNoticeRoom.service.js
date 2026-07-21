import { getAutoNoticeRoom } from '../../repositories/calibration/calibration.repo.js';
import {
  getInfoByUsernames,
  getUserByUsernames,
} from '../../repositories/user.repo.js';
import { sendNotificationMail } from '../../utils/useMail.js';

async function enrichOwners(rows) {
  // 1) 抽出所有 owner_username（去重）
  const usernames = [
    ...new Set(rows.map((r) => r.owner_username).filter(Boolean)),
  ];

  // 2) 批次查 user 資料
  const users = usernames.length > 0 ? await getUserByUsernames(usernames) : [];

  // 3) 建 map：username -> displayName（依你的 user 欄位調整）
  const userMap = new Map(
    users.map((u) => [u.username, u.fullname ?? u.name ?? u.Username])
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

function buildAutoNoticeHtml(items = []) {
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const displayMonth = nextMonthDate.getMonth() + 1;

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  const rows = items
    .map((item) => {
      return `
        <tr>
          <td>${formatDate(item.due_date)}</td>
          <td>${item.property_no || ''}</td>
          <td>${item.instrument?.system || ''}</td>
          <td>${item.instrument?.instru_name || ''}</td>
          <td>${item.owner || ''}</td>
          <td>${item.vendor || ''}</td>
          <td>${item.model || ''}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <p>Dear Sir/Madam,</p>

    <p>以下為 ${displayMonth} 月之儀器清單，請留意儀校日期並安排相關事宜。</p>

    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px;">
      <thead>
        <tr>
    <th style="background:#0d5cab;color:#ffffff;">預校日期</th>
        <th style="background:#0d5cab;color:#ffffff;">財產編號</th>
        <th style="background:#0d5cab;color:#ffffff;">儀器類別</th>
        <th style="background:#0d5cab;color:#ffffff;">儀器名稱</th>
        <th style="background:#0d5cab;color:#ffffff;">保管人</th>
        <th style="background:#0d5cab;color:#ffffff;">廠牌</th>
        <th style="background:#0d5cab;color:#ffffff;">型號</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <p>此信件由系統自動發送，請勿直接回覆。</p>
  `;
}

function getNextMonthRange(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  // 次月1號
  const start = new Date(year, month + 1, 1);

  // 次月最後一天（關鍵：month+2, day=0）
  const end = new Date(year, month + 2, 0);

  const format = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: format(start),
    endDate: format(end),
  };
}

function groupByOwner(rows) {
  const map = new Map();

  for (const r of rows) {
    if (!r.owner_username) continue; // ⚠️ 避免壞資料

    if (!map.has(r.owner_username)) {
      map.set(r.owner_username, []);
    }

    map.get(r.owner_username).push(r);
  }

  return map;
}

export async function calibrationAutoNoticeRoom() {
  const { startDate, endDate } = getNextMonthRange();
  const datas = await getAutoNoticeRoom(startDate, endDate);
  const enrichedDatas = await enrichOwners(datas);

  const groupbyOwners = groupByOwner(enrichedDatas);

  const usernames = [...groupbyOwners.keys()];
  const users = await getInfoByUsernames(usernames, 'username,email');

  const emailMap = new Map(users.map((u) => [u.username, u.email]));
  for (const [username, devices] of groupbyOwners) {
    const email = emailMap.get(username);

    if (!email) {
      console.warn(`找不到 email: ${username}`);
      continue;
    }

    const recipientEmail = email;

    const html = buildAutoNoticeHtml(devices);

    const subject = `儀器校驗預通知-請留意${new Date().getMonth() + 2}月之儀器校驗日期!!`;
    const mailOptions = {
      recipientEmail: recipientEmail,
      ccEmails: recipientEmail,
      subject,
      html,
    };
    await sendNotificationMail(mailOptions);
  }
}
