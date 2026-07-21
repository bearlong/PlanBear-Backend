import ftp from 'basic-ftp';
import fs from 'fs';
import readline from 'readline';
import iconv from 'iconv-lite';
import path from 'path';
import {
  getUserByFullnames,
  getInfoByUsernames,
} from '../../repositories/user.repo.js';
import {
  getExistingCalibrationsByPropertyNos,
  updateCalibrationById,
  insertCalibration,
} from '../../repositories/calibration/calibration.repo.js';
import { insertCalibrationLog } from '../../repositories/calibration/calibrationLog.repo.js';
import { sendNotificationMail } from '../../utils/useMail.js';

async function downloadFile() {
  const client = new ftp.Client();
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const folderPath = path.join(process.cwd(), 'data/uploads', 'sapFiles');

  try {
    // 確保下載目錄存在
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    await client.access({
      host: process.env.FTP_HOST,
      port: Number(process.env.FTP_PORT),
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false, // 舊 FTP 通常是 false
    });

    console.log('✅ FTP 連線成功');
    // 查看目前目錄
    await client.cd('/u/tiptop/sap');

    await client.downloadTo(
      `${folderPath}/assets_all_${dateStr}.txt`,
      `assets_all.txt`
    );

    console.log('下載完成');
  } catch (err) {
    console.error('❌ FTP error:', err);
  } finally {
    client.close();
  }
}

async function readFileLineByLine() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const filePath = path.join(
    process.cwd(),
    'data',
    'uploads',
    'sapFiles',
    `assets_all_${dateStr}.txt`
  );

  const stream = fs.createReadStream(filePath);

  const decodedStream = stream.pipe(iconv.decodeStream('big5'));

  const rl = readline.createInterface({
    input: decodedStream,
    crlfDelay: Infinity,
  });

  let items = [];

  for await (const line of rl) {
    if (!line.trim()) continue; // 跳過空行

    const item = parseLine(line);

    items.push(item);
  }
  return items;
}

function parseLine(line) {
  const [property_no, date, owner, description, price, factory] =
    line.split(';');

  return {
    property_no: normalizePropertyNo(property_no),
    date: formatDate(date),
    owner: owner?.trim(),
    description: description?.trim(),
    price: Number(price),
    factory: mapFactory(factory),
  };
}

function normalizePropertyNo(value) {
  if (!value) return null;

  const text = String(value).trim();

  // 純數字財編才去前導 0，例如 009600000129 → 9600000129
  // BB00067 這種英文字頭不要處理
  if (/^\d+$/.test(text)) {
    return text.replace(/^0+/, '');
  }

  return text;
}

function mapFactory(code) {
  const text = String(code || '').trim();

  const map = {
    1000: 'PHT',
    1016: 'ZTM',
  };

  return map[text] || text;
}

function formatDate(dateStr) {
  if (!dateStr) return null;

  return dateStr.replace(/\//g, '-');
}

function dedupeByPropertyAndFactory(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = `${row.property_no}_${row.factory}`;

    if (!map.has(key)) {
      map.set(key, row);
      continue;
    }
  }

  return Array.from(map.values());
}

function buildMailHtml(items = []) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = items
    .map((item) => {
      return `
        <tr>
          <td>${item.property_no}</td>
          <td>${item.date || ''}</td>
          <td>${item.description || ''}</td>
          <td>${item.owner || ''}</td>
          <td>${item.factory || ''}</td>
          <td>${item.price || ''}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <p>Dear Sir/Madam,</p>

    <p>以下為 ${today} 新增之儀器清單，請協助確認並補完詳細資料。</p>

    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px;">
      <thead>
        <tr>
        <th style="background:#0d5cab;color:#ffffff;">財產編號</th>
        <th style="background:#0d5cab;color:#ffffff;">入廠日期</th>
        <th style="background:#0d5cab;color:#ffffff;">儀器敘述</th>
        <th style="background:#0d5cab;color:#ffffff;">保管人</th>
        <th style="background:#0d5cab;color:#ffffff;">廠區</th>
        <th style="background:#0d5cab;color:#ffffff;">首次購入金額</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <p>此信件由系統自動發送，請勿直接回覆。</p>
  `;
}

export async function SAPDownCalibration() {
  try {
    await downloadFile();
    const items = await readFileLineByLine();
    console.log('✅ 讀取並解析檔案完成，資料筆數:', items.length);
    // const dedupedItems = dedupeByPropertyAndFactory(items);
    // const ownerNames = [
    //   ...new Set(dedupedItems.map((r) => r.owner).filter(Boolean)),
    // ];
    // const users = await getUserByFullnames(
    //   ownerNames,
    //   'fullname, username, dept_name'
    // );
    // const userMap = new Map(
    //   users.map((u) => [
    //     u.fullname,
    //     { username: u.username, dept: u.dept_name },
    //   ])
    // );
    // const enrichedItems = dedupedItems.map(({ sub_no, ...item }) => ({
    //   ...item,
    //   owner_username: userMap.get(item.owner)?.username || null,
    //   dept: userMap.get(item.owner)?.dept || null,
    // }));
    // const propertyNos = [
    //   ...new Set(enrichedItems.map((x) => x.property_no).filter(Boolean)),
    // ];
    // const existingRows =
    //   await getExistingCalibrationsByPropertyNos(propertyNos);
    // const existingSet = new Set(
    //   existingRows.map((x) => `${x.property_no}__${x.factory}`)
    // );
    // const existingMap = new Map(
    //   existingRows.map((x) => [`${x.property_no}__${x.factory}`, x])
    // );
    // const insertItems = [];
    // const updateItems = [];
    // for (const item of enrichedItems) {
    //   const key = `${item.property_no}__${item.factory}`;
    //   if (existingSet.has(key)) {
    //     updateItems.push(item);
    //   } else {
    //     insertItems.push(item);
    //   }
    // }

    // for (const item of updateItems) {
    //   const existingItem = existingMap.get(
    //     `${item.property_no}__${item.factory}`
    //   );
    //   const updateData = {
    //     date: item.date,
    //     owner_username: item.owner_username,
    //     owner: item.owner,
    //     dept: item.dept,
    //     description: item.description,
    //     first_price: item.price,
    //   };
    //   if (existingItem) {
    //     await updateCalibrationById(existingItem.id, updateData);
    //   }
    // }
    // for (const item of insertItems) {
    //   const { price, ...calibrationData } = item;
    //   const newitem = {
    //     ...calibrationData,
    //     first_price: price,
    //     change_date: item.date,
    //   };
    //   const result = await insertCalibration(newitem);
    //   if (result) {
    //     const logItem = {
    //       calibration_id: result.id,
    //       property_no: item.property_no,
    //       factory: item.factory,
    //       requires_report_approval: 'Y',
    //       status: 'Usable',
    //       calibman: 'New Item',
    //       change_date: item.date,
    //       due_date: item.date,
    //     };
    //await insertCalibrationLog(logItem);
    //   }
    // }
    // if (insertItems.length > 0) {
    //   const RECIPIENT_USERNAME = 8892;
    //   const users = await getInfoByUsernames(
    //     [RECIPIENT_USERNAME],
    //     'username,email'
    //   );
    //   const recipientEmail = users[0]?.email;
    // if (!recipientEmail) {
    //   console.warn('No recipient email found');
    //   return;
    // }
    //   const today = new Date().toISOString().slice(0, 10);
    //   const html = buildMailHtml(insertItems);
    //   await sendNotificationMail({
    //     recipientEmail: recipientEmail,
    //     ccEmails: recipientEmail,
    //     subject: `${today} 儀器設備新增 ${insertItems.length} 筆資料`,
    //     html: html,
    //   });
    // }
    // 在這裡執行你的新增和更新邏輯，例如呼叫 API 或寫入資料庫
  } catch (error) {
    console.error('❌ SAPDownCalibration error:', error);
  }
}
