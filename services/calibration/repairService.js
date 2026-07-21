import {
  insertRepairApplication,
  insertRepairItem,
  deleteRepairApplication,
  getRepairLists,
  getRepairApplicationByApplyNo,
  updateRepairItemById,
  insertRepairFile,
  updateRepairApplicationById,
  deleteRepairFile,
} from '../../repositories/calibration/repair.repo.js';
import { logAction, logUserAction } from '../../utils/useLogger.js';
import {
  insertCalibrationFile,
  deleteCalibrationFile,
} from '../../repositories/calibration/calibrationFile.repo.js';
import { getUserByUsernames } from '../../repositories/user.repo.js';

export async function getRepairApplicationLists(queryParams = {}) {
  const {
    property_no,
    status,
    apply_no,
    instru_name,
    applicant,
    start_date,
    end_date,
    factory,
    pages,
  } = queryParams;

  try {
    const { data, count, totalPages } = await getRepairLists({
      property_no,
      status,
      apply_no,
      instru_name,
      applicant,
      start_date,
      end_date,
      factory,
      pages,
    });

    if (!data) {
      {
        return {
          status: 'error',
          message: 'Failed to fetch repair application lists',
        };
      }
    }
    const usernames = [...new Set(data.map((item) => item.applicant))];

    const applicants = await getUserByUsernames(usernames);

    const applicantMap = new Map(
      applicants.map((user) => [user.username, user])
    );

    const enrichedData = data.map((item) => {
      const applicantInfo = applicantMap.get(item.applicant);
      return {
        ...item,
        applicant_info: applicantInfo ? applicantInfo.fullname : null,
      };
    });

    return { status: 'success', data: enrichedData, count, totalPages };
  } catch (err) {
    console.error('Error fetching repair application lists:', err);
    return {
      status: 'error',
      message: 'Failed to fetch repair application lists',
    };
  }
}

export async function getRepairApplicationDetails(apply_no) {
  try {
    const { data } = await getRepairApplicationByApplyNo(apply_no);
    if (!data) {
      return {
        status: 'error',
        message: 'Repair application not found',
      };
    }

    const usernames = [
      ...new Set(
        [
          data.applicant,
          data.requester,
          ...(data.gauge_instrument_repair_item || []).map(
            (subItem) => subItem.owner
          ),
        ].filter(Boolean)
      ),
    ];

    const users = await getUserByUsernames(usernames);

    const userMap = new Map(users.map((user) => [user.username, user]));

    const applicantInfo = userMap.get(data.applicant);
    const requesterInfo = userMap.get(data.requester);

    const enrichedData = {
      ...data,
      applicant_info: applicantInfo ? applicantInfo.fullname : null,
      requester_info: requesterInfo ? requesterInfo.fullname : null,
      gauge_instrument_repair_item: (
        data.gauge_instrument_repair_item || []
      ).map((subItem) => {
        const ownerInfo = userMap.get(subItem.owner);

        return {
          ...subItem,
          owner_info: ownerInfo ? ownerInfo.fullname : null,
        };
      }),
    };
    return { status: 'success', data: enrichedData };
  } catch (err) {
    console.error('Error fetching repair application details:', err);
    return {
      status: 'error',
      message: 'Failed to fetch repair application details',
    };
  }
}

export async function createRepairApplication(applicationData, repairItems) {
  let applicationId;
  try {
    const result = await insertRepairApplication(applicationData);
    applicationId = result.id;

    const itemPromises = repairItems.map((item) => {
      const { id, ...rest } = item;
      return insertRepairItem({
        ...rest,
        application_id: applicationId,
        status: applicationData.status,
      });
    });

    await Promise.all(itemPromises);

    return { status: 'success', data: applicationId };
  } catch (err) {
    // rollback（補救）
    if (applicationId) {
      await deleteRepairApplication(applicationId);
    }

    return { status: 'error', message: 'Failed to create repair application' };
  }
}

export async function updateRepairItemWithFiles(user, item, files) {
  const { apply_no, status, gauge_instrument_repair_item, delete_file_id } =
    item;

  for (const subItem of gauge_instrument_repair_item) {
    if (!subItem.id) continue;

    await updateRepairItemById(subItem.id, {
      repair_order_number: subItem.repair_order_number || '',
      repair_date: subItem.repair_date ? subItem.repair_date : null,
      revised_date: subItem.revised_date ? subItem.revised_date : null,
      memo: subItem.memo || '',
      status,
    });
  }

  if (delete_file_id?.length > 0) {
    const deleteFilePromises = delete_file_id.map(
      async ([calibrationId, repairUrl]) => {
        try {
          await deleteRepairFile(calibrationId);
          await deleteCalibrationFile(repairUrl);
        } catch (err) {
          throw new Error(
            `Delete failed: calibrationId=${calibrationId}, repairUrl=${repairUrl}, msg=${err.message}`
          );
        }
      }
    );

    await Promise.all(deleteFilePromises);
  }

  if (files && files.length > 0) {
    const saveTasks = files.map(async (file) => {
      const savedFile = await insertCalibrationFile(file.file);
      const newItem = {
        item_id: Number(file.itemId),
        file_name: savedFile.file_name,
        file_type: savedFile.file_type,
        file_url: savedFile.file_url,
        uploaded_by: user.username,
      };
      if (!savedFile) {
        throw new Error('Failed to save physical file');
      }
      const { data, error } = await insertRepairFile(newItem);
      if (error) {
        console.error('Failed to save log file record:', error);
        throw new Error('Failed to save log file record');
      }
    });
    await Promise.all(saveTasks);
  }

  if (status === 'finished') {
    await updateRepairApplicationById(apply_no, { status: 'finished' });
  }

  return { status: 'success', message: 'Repair item updated successfully.' };
}
