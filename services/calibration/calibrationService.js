import {
  checkCalibrationDuplicate,
  insertCalibration,
  getCalibrationLists,
  getDistinctOwner,
  getCalibrationById,
  getCalibrationInfo,
  updateCalibrationById,
  getHistoryByCalibrationId,
  updateAllCalibration,
  insertCalibrationCost,
  updateCalibrationCost,
  deleteCalibrationCost,
  deleteCalibration,
  getCalibrationStatisticOptions,
} from '../../repositories/calibration/calibration.repo.js';
import { sendNotificationMail } from '../../utils/useMail.js';
import { insertCalibrationFile } from '../../repositories/calibration/calibrationFile.repo.js';
import { deleteCalibrationFile } from '../../repositories/calibration/calibrationFile.repo.js';
import {
  insertCalibrationLog,
  insertCalibrationLogFile,
  insertPropertyNoChangeLog,
  getCalibrationLogById,
  updateCalibrationLogStatus,
  deleteCalibrationLogFilesByIds,
  getPropertyNoLogsByUser,
  getPropertyNoLogsByCalibrationId,
  updateCalibrationLogPropertyNo,
  getHistoriesWithCalibrationInfo,
  getHistoriesWithCalibration,
  deleteCalibrationLog,
  getLogFiles,
} from '../../repositories/calibration/calibrationLog.repo.js';
import { addPendingTasks, finishPendingTask } from '#utils/usePendingTask.js';

import {
  getUserByUsernames,
  getInfoByUsernames,
} from '../../repositories/user.repo.js';

function normalizeEmptyToNull(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (v === undefined || v === null) return [k, null];
      if (typeof v === 'string' && v.trim() === '') return [k, null];
      if (typeof v === 'number' && Number.isNaN(v)) return [k, null];
      return [k, v];
    })
  );
}

function formatDate(date) {
  return date ? date.slice(0, 10) : null;
}

function chunkArray(array, size) {
  const result = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

async function updateCalibrationLogChangeDate(logId) {
  const today = new Date().toISOString().slice(0, 10);
  const lastLogUpdate = {
    change_date: today,
  };

  if (logId) {
    await updateCalibrationLogStatus(logId, lastLogUpdate);
  }
}

async function batchUpdateCalibrationWithLog(ids, user, config) {
  const { updateData, getRemark, logStatus } = config;

  const results = await updateAllCalibration(ids, updateData);
  const validResults = results.filter(Boolean);

  if (validResults.length !== ids.length) {
    throw new Error('Some calibrations were not found');
  }

  const currentItems = await Promise.all(
    validResults.map((res) => getCalibrationById(res.id))
  );

  const enrichedItems = await enrichOwners(currentItems);
  const logids = [];

  for (const item of enrichedItems) {
    const payload = {
      calibration_id: item.id,
      property_no: item.property_no,
      factory: item.factory,
      remark: typeof getRemark === 'function' ? getRemark(item) : getRemark,
      status: logStatus,
      requires_report_approval: 'Y',
      calibman: user.name,
      due_date: item.due_date,
    };

    const logId = await insertCalibrationLog(payload);

    const lastLog = item.calibration_log?.[item.calibration_log.length - 1];
    if (lastLog) {
      await updateCalibrationLogChangeDate(lastLog.id);
    }
    logids.push(logId);
  }

  return logids;
}

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

async function saveCalibrationLogFiles(files, logId, user) {
  if (!files?.length) return;

  const saveTasks = files.map(async (file) => {
    const savedFile = await insertCalibrationFile(file);

    const payload = {
      log_id: Number(logId),
      file_name: savedFile.file_name,
      file_type: savedFile.file_type,
      file_url: savedFile.file_url,
      uploaded_by: user.username,
    };

    const { error } = await insertCalibrationLogFile(payload);

    if (error) {
      console.error('Failed to save log file record:', error);
      throw new Error('Failed to save log file record');
    }
  });

  await Promise.all(saveTasks);
}

export async function createCalibration(calibrationItem) {
  const { property_no, factory } = calibrationItem;

  const isDuplicate = await checkCalibrationDuplicate(property_no, factory);
  if (isDuplicate) {
    return {
      status: 'error',
      message:
        'Calibration with the same property number already exists in this factory.',
    };
  }

  const normalizedItem = normalizeEmptyToNull(calibrationItem);
  const result = await insertCalibration(normalizedItem);

  if (result) {
    const logItem = {
      calibration_id: result.id,
      property_no: property_no,
      factory: factory,
      requires_report_approval: 'Y',
      status: 'Usable',
      calibman: 'New Item',
      due_date: normalizedItem.change_date,
    };
    const logId = await insertCalibrationLog(logItem);
  }
  return {
    status: 'success',
    message: 'Calibration created successfully.',
    data: result,
  };
}

export async function getCalibrationListView(queryParams) {
  const { data, count, totalPages } = await getCalibrationLists(queryParams);
  const enriched = await enrichOwners(data);
  return { enriched, count, totalPages };
}
export async function getCalibrationByIdView(id) {
  const calibration = await getCalibrationById(id);
  if (!calibration) {
    throw new Error('Calibration not found');
  }
  const enriched = await enrichOwners([calibration]);
  return enriched[0];
}

export async function getHistoryByIdView(calibrationId) {
  const history = await getHistoryByCalibrationId(calibrationId);
  if (!history) {
    throw new Error('Calibration history not found');
  }
  const formattedHistory = history.map((item) => ({
    id: item.id,
    calibration_log_file: item.calibration_log_file,
    status: item.status,
    remark: item.remark,
    requires_report_approval: item.requires_report_approval,
    created_at: formatDate(item.created_at),
    due_date: formatDate(item.due_date),
    change_date: formatDate(item.change_date),
    calibration_id: item.calibration_id,
  }));

  return formattedHistory;
}

export async function getCalibrationStatisticsSelectOptions() {
  const data = await getCalibrationStatisticOptions();

  const rawOptions = [
    ...(data?.depts || []).map((dept) => ({
      label: dept,
      value: `dept|${dept}`,
    })),

    ...(data?.factories || []).map((factory) => ({
      label: factory,
      value: `factory|${factory}`,
    })),
  ];

  return rawOptions;
}

export async function getCalibrationStatistics(type, eGroup) {
  const queryParams = {
    paginate: false,
    dept: type === 'dept' ? eGroup : undefined,
    factory: type === 'factory' ? eGroup : undefined,
  };
  const { data } = await getCalibrationLists(queryParams);
  const enriched = await enrichOwners(data);
  const groupedData = enriched.reduce((acc, item) => {
    const key = item.instrument?.instru_name || 'Unknown';
    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(item);

    return acc;
  }, {});

  const groupedArray = Object.entries(groupedData).map(
    ([groupName, items]) => ({
      groupName,
      system: items[0].instrument?.system || 'Unknown',
      count: items.length,
      items,
    })
  );

  return groupedArray;
}

export async function getSignatureById(calibrationId) {
  const history = await getHistoryByCalibrationId(calibrationId);
  if (!history) {
    throw new Error('Signature not found');
  }
  const signature = history.filter(
    (item) => item.requires_report_approval === 'T'
  );
  if (!signature) {
    throw new Error('Signature not found');
  }
  return signature[0];
}

export async function addLogWithReport(user, item, files) {
  const current = await getCalibrationById(item.id);
  if (!current) {
    throw new Error('Calibration not found');
  }
  const enriched = await enrichOwners([current]);
  const property_no = enriched[0].property_no;

  const history = await getHistoryByCalibrationId(item.id);
  const lastLog = history?.[history.length - 1];
  const due_date = new Date(item.change_date);
  due_date.setDate(due_date.getDate() + 1);
  const logItem = {
    property_no: property_no,
    factory: enriched[0].factory,
    calibration_id: item.id,
    status: item.status,
    requires_report_approval: 'T',
    calibman: user.name,
    change_date: item.change_date,
    due_date: item.due_date || due_date,
  };

  let logid;

  if (lastLog && lastLog.status === 'Calibration') {
    const keepFileIds = String(item.keep_file_ids || '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const existingFiles = Array.isArray(lastLog.calibration_log_file)
      ? lastLog.calibration_log_file
      : [];
    const removableFiles = existingFiles.filter(
      (file) => !keepFileIds.includes(file.id)
    );

    if (removableFiles.length > 0) {
      await deleteCalibrationLogFilesByIds(
        removableFiles.map((file) => file.id)
      );
      await Promise.all(
        removableFiles.map((file) => deleteCalibrationFile(file.file_url))
      );
    }
    await updateCalibrationLogStatus(lastLog.id, logItem);
    logid = lastLog.id;
  } else {
    const change_status = {
      status: item.status,
    };

    await updateCalibrationLogChangeDate(lastLog?.id);
    await updateCalibrationById(item.id, change_status);
    logid = await insertCalibrationLog(logItem);
  }

  // const logid = await insertCalibrationLog(logItem);

  await saveCalibrationLogFiles(files, logid, user);

  finishPendingTask(user.username, property_no);
  return { status: 'success', message: 'Log added successfully.' };
}

export async function updateCalibrationHistoryLog(user, log_id, item, files) {
  const log = await getCalibrationLogById(log_id);
  if (!log) {
    throw new Error('Calibration log not found');
  }

  const patch = {};

  if (item.change_date !== undefined) {
    patch.change_date = item.change_date || null;
  }
  if (item.due_date !== undefined) {
    patch.due_date = item.due_date || null;
  }

  if (item.created_at !== undefined) {
    patch.created_at = item.created_at || null;
  }

  if (Object.keys(patch).length > 0) {
    await updateCalibrationLogStatus(log_id, patch);
  }

  const keepFileIds = String(item.keep_file_ids || '')
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const existingFiles = Array.isArray(log.calibration_log_file)
    ? log.calibration_log_file
    : [];
  const removableFiles = existingFiles.filter(
    (file) => !keepFileIds.includes(file.id)
  );

  if (removableFiles.length > 0) {
    await deleteCalibrationLogFilesByIds(removableFiles.map((file) => file.id));
    await Promise.all(
      removableFiles.map((file) => deleteCalibrationFile(file.file_url))
    );
  }

  await saveCalibrationLogFiles(files, log_id, user);

  const history = await getHistoryByCalibrationId(log.calibration_id);
  const latestLog = history?.[history.length - 1];

  if (latestLog?.id === Number(log_id)) {
    const matched = await getCalibrationById(log.calibration_id);

    if (matched) {
      const calibrationPatch = {};

      if (item.change_date !== undefined) {
        calibrationPatch.change_date = item.change_date || null;
      }
      if (Object.keys(calibrationPatch).length > 0) {
        await updateCalibrationById(matched.id, calibrationPatch);
      }
    }
  }

  return {
    status: 'success',
    message: 'Calibration log updated successfully.',
  };
}

export async function approveCalibrationReport(log_id, instrument_id, user) {
  const result = await updateCalibrationLogStatus(log_id, {
    requires_report_approval: 'Y',
    remark: null,
  });
  if (!result) {
    throw new Error('Calibration log not found');
  }

  const payload = {
    status: 'Usable',
    change_date: result.change_date,
    received: false,
    due_date: result.due_date,
  };
  const calibration = await updateCalibrationById(instrument_id, payload);
  const updatedCalibration = await getCalibrationById(instrument_id);
  const enriched = await enrichOwners([updatedCalibration]);
  const logid = await insertCalibrationLog({
    calibration_id: updatedCalibration.id,
    property_no: enriched[0].property_no,
    factory: enriched[0].factory,
    status: 'Usable',
    requires_report_approval: 'Y',
    calibman: user.name,
    due_date: enriched[0].due_date,
  });

  if (process.env.NODE_ENV === 'production') {
    const toUsername = enriched?.[0]?.owner_username;
    const ccUsernames = [
      user.username,
      // 未來可以繼續加
      // approver.username,
      // manager.username,
    ].filter(Boolean);

    const allUsernames = [toUsername, ...ccUsernames];

    const users = await getInfoByUsernames(allUsernames, 'username,email');

    const userMap = new Map(users.map((u) => [u.username, u.email]));

    const toEmail = userMap.get(toUsername);

    const ccEmails = ccUsernames.map((u) => userMap.get(u)).filter(Boolean);

    const instrumentName = enriched?.[0]?.instrument?.instru_name ?? '';
    const propertyNo = enriched?.[0]?.property_no ?? '';
    const instrumentSystem = enriched?.[0]?.instrument?.system ?? '';
    await sendNotificationMail({
      recipientEmail: toEmail,
      ccEmails,
      subject: `儀校完成通知 - ${propertyNo}`,
      message: `Property No: ${propertyNo}
Instrument Category(儀器類別): ${instrumentSystem}
Instrument Name: ${instrumentName}

已校驗完成，請盡速領回，謝謝！`,
    });
    console.log(`寄信完成：成功 1 封，失敗 0 封`);
  }

  return logid;
}

export async function rejectCalibrationReport(
  log_id,
  instrument_id,
  reason,
  user
) {
  const result = await updateCalibrationLogStatus(log_id, {
    requires_report_approval: 'R',
    remark: reason,
  });
  if (!result) {
    throw new Error('Calibration log not found');
  }

  const instrument = await getCalibrationById(instrument_id);
  if (!instrument) {
    throw new Error('Calibration not found');
  }

  const log = await getCalibrationLogById(log_id);
  if (!log) {
    throw new Error('Calibration log not found');
  }

  addPendingTasks(
    log.calibration_log_file[0]?.uploaded_by,
    'Calibrattion',
    instrument.property_no,
    '儀校報告退件',
    reason,
    `Calibration/instruments/${instrument_id}`
  );

  return { status: 'success', message: 'Calibration report rejected.' };
}

export async function updateCalibrationAndUploadFiles(user, id, item, files) {
  const { keep_file_ids, ...rest } = item;
  const current = await getCalibrationById(id);
  if (!current) {
    throw new Error('Calibration not found');
  }

  const [calibration] = await enrichOwners([current]);
  const normalizedItem = normalizeEmptyToNull(rest);

  const result = await updateCalibrationById(id, normalizedItem);

  const oldStatus = calibration.status;
  const newStatus = normalizedItem.status;
  const oldscrap_remark = calibration.scrap_remark;
  const newscrap_remark = normalizedItem.scrap_remark;

  const scrapRemarkChanged = newscrap_remark !== oldscrap_remark;

  const statusChanged =
    newStatus !== undefined && newStatus !== null && newStatus !== oldStatus;

  let targetLogId = null;

  const lastLog =
    calibration.calibration_log?.[calibration.calibration_log.length - 1];

  if (statusChanged) {
    const payload = {
      calibration_id: calibration.id,
      property_no: calibration.property_no,
      factory: calibration.factory,
      remark: newscrap_remark ?? null,
      status: newStatus,
      requires_report_approval: 'Y',
      calibman: user.name,
      due_date: calibration.due_date,
    };

    targetLogId = await insertCalibrationLog(payload);

    await updateCalibrationLogChangeDate(lastLog.id);
  } else {
    if (!lastLog) {
      throw new Error('Calibration log not found');
    }
    const lastLogData = await getCalibrationLogById(lastLog.id);

    targetLogId = lastLog.id;

    if (scrapRemarkChanged) {
      await updateCalibrationLogStatus(lastLog.id, {
        remark: newscrap_remark,
      });
    }

    const keepFileIds = String(keep_file_ids || '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const existingFiles = Array.isArray(lastLogData.calibration_log_file)
      ? lastLogData.calibration_log_file
      : [];
    const removableFiles = existingFiles.filter(
      (file) => !keepFileIds.includes(file.id)
    );
    if (removableFiles.length > 0) {
      await deleteCalibrationLogFilesByIds(
        removableFiles.map((file) => file.id)
      );
      await Promise.all(
        removableFiles.map((file) => deleteCalibrationFile(file.file_url))
      );
    }
  }

  await saveCalibrationLogFiles(files, targetLogId, user);
  return result;
}

export async function batchUpdateCalibrationsStatus(ids, user, status, remark) {
  return batchUpdateCalibrationWithLog(ids, user, {
    updateData: { status },
    getRemark: remark ?? `批次更新狀態為 ${status}`,
    logStatus: status,
  });
}

export async function receivedCalibrations(ids) {
  const payload = {
    received: true,
  };
  const results = await updateAllCalibration(ids, payload);
  return results.filter(Boolean);
}

export async function sendNotificationMailByIds(ids) {
  const handleCheckDelay = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  };
  const calibrations = await Promise.all(
    ids.map((id) => getCalibrationById(id))
  );
  const enriched = await enrichOwners(calibrations);
  for (const item of enriched) {
    const toEmail = item.owner_username
      ? (await getInfoByUsernames([item.owner_username], 'username,email'))[0]
          ?.email
      : null;
    if (!toEmail) {
      console.warn(
        `No email found for owner_username=${item.owner_username}, skipping email notification`
      );
      continue;
    }
    const due_date = item.due_date ? formatDate(item.due_date) : 'N/A';
    const delayDays = handleCheckDelay(item.due_date);
    const propertyNo = item.property_no ?? '';
    const dept = item.dept ?? '';
    const owner = item.owner ?? '';
    const calibr_cycle = item.calibr_cycle ?? '';
    await sendNotificationMail({
      recipientEmail: toEmail,
      subject: `儀校室通知:貴單位儀器設備( ${propertyNo} ), 校驗日已逾期 ${delayDays} 天,請盡速送達儀校室校驗!`,
      message: `
應送校驗日期: ${due_date}
      財產編號: ${propertyNo}
      部門: ${dept}
      保管人: ${owner}
      送校週期: ${calibr_cycle}
延遲校驗提醒: 貴單位儀器設備若有延遲校驗需求,請依儀器校驗管理程序 ISO文件編號:PHG-Q2-CC01 ver:E6 5.7.3 校驗計畫 以連絡單方式提出申請!
`,
    });
  }

  return { status: 'success', message: 'Notification sent successfully.' };
}

export async function getDistinctOwnerView() {
  const data = await getDistinctOwner();
  const usernames = [
    ...new Set(data.map((r) => r.owner_username).filter(Boolean)),
  ];
  const owners = await getUserByUsernames(usernames);
  const userMap = new Map(owners.map((u) => [u.username, u]));

  const enrichedOwners = data.map((r) => {
    if (!r.owner_username) return r;

    const user = userMap.get(r.owner_username);
    return {
      owner: user?.fullname ?? r.owner,
      owner_username: r.owner_username,
    };
  });
  return enrichedOwners;
}

export async function saveCalibrationCost(id, cost, user) {
  const existing = await getCalibrationById(id);
  if (!existing) {
    throw new Error('Calibration not found');
  }

  if (existing.calibration_cost) {
    const now = new Date().toISOString();
    const costNumber = Number(cost);
    const payload = {
      cost: costNumber,
      update_by: user.username,
      update_at: now,
    };
    const result = await updateCalibrationCost(id, payload);

    if (!result) {
      throw new Error('Failed to update calibration cost');
    }
    return {
      status: 'success',
      message: 'Calibration cost updated successfully.',
    };
  }

  const payload = {
    cost,
    calibration_id: id,
    update_by: user.username,
  };
  const result = await insertCalibrationCost(payload);
  if (!result) {
    throw new Error('Failed to save calibration cost');
  }
  return { status: 'success', message: 'Calibration cost saved successfully.' };
}

export async function deleteCalibrationCostById(id) {
  const existing = await getCalibrationById(id);
  if (!existing) {
    throw new Error('Calibration not found');
  }

  if (!existing.calibration_cost) {
    throw new Error('Calibration cost not found');
  }
  await deleteCalibrationCost(id);

  return {
    status: 'success',
    message: 'Calibration cost deleted successfully.',
  };
}

export async function changeCalibrationPropertyNoById(id, item, user) {
  const existing = await getCalibrationById(id);
  if (!existing) {
    throw new Error('Calibration not found');
  }

  const result = await updateCalibrationById(id, {
    property_no: item.propertyNo,
  });

  if (!result) {
    throw new Error('Failed to update calibration property number');
  }
  const payload = {
    calibration_id: id,
    old_property_no: existing.property_no,
    new_property_no: item.propertyNo,
    update_by: user.username,
    factory: existing.factory,
    remark: item.remark,
  };

  const logResult = await insertPropertyNoChangeLog(payload);

  const calibrationLogResult = await updateCalibrationLogPropertyNo(
    existing.property_no,
    item.propertyNo,
    existing.factory
  );

  if (!logResult) {
    throw new Error('Failed to insert property number change log');
  }

  return {
    status: 'success',
    message: 'Calibration property number updated successfully.',
    data: logResult,
  };
}

export async function getPropertyNoChangeHistory(type, id) {
  let result;
  if (type === 'device') {
    result = await getPropertyNoLogsByCalibrationId(id);
  } else if (type === 'user') {
    result = await getPropertyNoLogsByUser(id);
  } else {
    throw new Error('Invalid type parameter');
  }

  const usernames = [
    ...new Set(result.map((r) => r.update_by).filter(Boolean)),
  ];
  const users = await getUserByUsernames(usernames);
  const userMap = new Map(
    users.map((u) => [
      u.username,
      `${u.ename || ''} ${u.fullname || ''}`.trim(),
    ])
  );
  const enriched = result.map((r) => ({
    ...r,
    update_by_name: userMap.get(r.update_by) ?? r.update_by,
  }));

  return enriched;
}

export async function getCalculationTime(filter) {
  const {
    factory,
    dateType,
    calibrationClass,
    dateFrom,
    dateTo,
    pages,
    paginate,
  } = filter;
  const history = await getHistoriesWithCalibration(
    factory,
    dateType,
    calibrationClass,
    dateFrom,
    dateTo,
    pages,
    paginate
  );
  if (!history) {
    throw new Error('Calibration history not found');
  }

  return history;
}

export async function getHistoriesByFilter(filter) {
  const {
    factory,
    dateType,
    calibrationClass,
    dateFrom,
    dateTo,
    pages,
    paginate,
  } = filter;
  const logs = await getHistoriesWithCalibrationInfo(
    factory,
    dateType,
    calibrationClass,
    dateFrom,
    dateTo,
    pages,
    paginate
  );

  if (!logs) {
    throw new Error('Calibration history not found');
  }

  const logIds = logs.map((item) => item.id);
  const fileChunks = chunkArray(logIds, 500);

  let allFiles = [];

  for (const chunk of fileChunks) {
    const files = await getLogFiles(chunk);

    allFiles = allFiles.concat(files || []);
  }

  const fileMap = new Map();

  allFiles.forEach((file) => {
    const key = file.log_id;

    if (!fileMap.has(key)) {
      fileMap.set(key, []);
    }

    fileMap.get(key).push(file);
  });
  const mappedData = logs.map((item) => ({
    ...item,
    calibration: {
      id: item.calibration_id,
      property_no: item.property_no,
      dept: item.dept,
      factory: item.factory,
      vendor: item.vendor,
      model: item.model,
      calibr_class: item.calibr_class,
      calibration_cost: item.calibration_cost
        ? [{ cost: item.calibration_cost }]
        : [],
    },
    calibration_log_file: fileMap.get(item.id) || [],
  }));

  return mappedData;
}

export async function deleteCalibrationWithFiles(id) {
  const existing = await getCalibrationById(id);
  if (!existing) {
    throw new Error('Calibration not found');
  }

  await deleteCalibration(id);
  const historyResult = await getHistoryByCalibrationId(id);
  const logfiles = historyResult.map((log) => log.calibration_log_file).flat();
  const deleteFileTasks = logfiles.map((file) =>
    deleteCalibrationFile(file.file_url)
  );
  await Promise.all(deleteFileTasks);

  return {
    status: 'success',
    message: 'Calibration deleted successfully.',
  };
}

export async function deleteCalibrationLogById(log_id) {
  const existing = await getCalibrationLogById(log_id);
  if (!existing) {
    throw new Error('Calibration log not found');
  }

  await deleteCalibrationLog(log_id);

  return {
    status: 'success',
    message: 'Calibration log deleted successfully.',
  };
}
