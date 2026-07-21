import { getAutoNoticeCalibrationByFactoryDept } from '../../repositories/calibration/calibration.repo.js';
import {
  getAutoNoticeMemberWithUselevel,
  getNoticeMembersByFactoryDept,
} from '../../repositories/calibration/noticeMemberList.repo.js';
import {
  getInfoByUsernames,
  getUserByUsernames,
} from '../../repositories/user.repo.js';
import { sendNotificationMail } from '../../utils/useMail.js';
import { logUserAction } from '../../utils/useLogger.js';

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

function groupByFactoryDept(items = []) {
  const groupMap = new Map();

  for (const item of items) {
    const factory = item.factory || '';
    const dept = item.dept || '';

    const key = `${factory}__${dept}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        factory,
        dept,
      });
    }
  }

  return Array.from(groupMap.values());
}

function groupByOwner(items = []) {
  const map = new Map();

  for (const item of items) {
    const ownerUsername = item.owner_username || 'NO_OWNER';

    if (!map.has(ownerUsername)) {
      map.set(ownerUsername, {
        owner_username: item.owner_username,
        owner: item.owner,
        items: [],
      });
    }

    map.get(ownerUsername).items.push(item);
  }

  return Array.from(map.values());
}

function uniqueEmails(emails = []) {
  return [
    ...new Set(emails.filter(Boolean).map((e) => e.trim().toLowerCase())),
  ];
}

function buildRecipients({ ownerEmail, noticeMembers, userMap }) {
  const to = uniqueEmails([
    ownerEmail,
    ...noticeMembers
      .filter((m) => !m.cc)
      .map((m) => userMap.get(m.username)?.email),
  ]);

  const rawCc = uniqueEmails(
    noticeMembers.filter((m) => m.cc).map((m) => userMap.get(m.username)?.email)
  );

  // CC 內如果已經在 TO，就移除
  const cc = rawCc.filter((email) => !to.includes(email));

  return { to, cc };
}

function buildAutoNoticeHtml(items = []) {
  const rows = items
    .map((item) => {
      return `
        <tr>
          <td>${item.due_date}</td>
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

    <p>以下為尚未完成校驗且已逾期 21 天內之儀器清單，請協助確認並盡快處理。</p>

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

export async function calibrationAutoNoticeAll() {
  try {
    const autoNoticeByFactoryDept = await getAutoNoticeMemberWithUselevel();

    const enabledGroups = groupByFactoryDept(autoNoticeByFactoryDept);
    for (const group of enabledGroups) {
      const { factory, dept } = group;
      const autoNoticeItems = await getAutoNoticeCalibrationByFactoryDept(
        factory,
        dept
      );

      if (autoNoticeItems.length === 0) continue;

      const noticeMembers = await getNoticeMembersByFactoryDept(
        group.factory,
        group.dept
      );

      const ownerGroups = groupByOwner(autoNoticeItems);

      for (const ownerGroup of ownerGroups) {
        const usernames = [
          ownerGroup.owner_username,
          ...noticeMembers.map((x) => x.username),
        ].filter(Boolean);

        const uniqueUsernames = [...new Set(usernames)];

        const users = await getInfoByUsernames(
          uniqueUsernames,
          'username,email'
        );

        const userMap = new Map(users.map((u) => [u.username, u]));

        const ownerEmail = userMap.get(ownerGroup.owner_username)?.email;
        const { to, cc } = buildRecipients({
          ownerEmail,
          noticeMembers,
          userMap,
        });

        const enrichOwnerItems = await enrichOwners(ownerGroup.items);

        const html = buildAutoNoticeHtml(enrichOwnerItems);
        const mailConfig = {
          recipientEmail: to.join(', '),
          ccEmails: cc.join(', '),
          subject: `儀器校驗已過期通知-請送至儀校室校驗,逾期21天內如未送校正將予以貼停用標籤!!`,
          html,
        };
        await sendNotificationMail(mailConfig);
        console.log(`寄信完成：成功 1 封，失敗 0 封`);
      }
    }
  } catch (error) {
    console.error('Error in calibrationAutoNoticeAll:', error);
  }
}
