import supabase from '../../configs/supabase.js';

export async function insertCalibrationLog(logItem) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log')
    .insert([logItem])
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data?.id;
}

export async function insertCalibrationLogFile(logItem) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log_file')
    .insert([logItem])
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function insertPropertyNoChangeLog(item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_property_no_update_log')
    .insert([item])
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function getCalibrationLogById(id) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log')
    .select('*,calibration_log_file(*)')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function getPropertyNoLogsByCalibrationId(calibrationId) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_property_no_update_log')
    .select('*')
    .eq('calibration_id', calibrationId);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getPropertyNoLogsByUser(username) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_property_no_update_log')
    .select(`*,calibration:calibration (id, property_no)`)
    .eq('update_by', username);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getHistoriesWithCalibrationInfo(
  factory,
  dateType,
  calibrationClass,
  startDate,
  endDate
) {
  const querybuilder = supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_report_log_v')
    .select(
      `
    *
    `,
      { count: 'exact' }
    );

  if (factory) {
    querybuilder.eq('factory', factory);
  }

  if (calibrationClass) {
    querybuilder.eq('calibr_class', calibrationClass);
  }

  if (dateType && startDate) {
    querybuilder.gte(dateType, startDate);
  }

  if (dateType && endDate) {
    querybuilder.lte(dateType, endDate);
  }
  const { data, error } = await querybuilder.order('id', {
    ascending: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getLogFiles(logIds) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log_file')
    .select('*')
    .in('log_id', logIds)
    .order('id', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getHistoriesWithCalibration(
  factory,
  dateType,
  calibrationClass,
  startDate,
  endDate,
  pages = 1,
  paginate = true
) {
  const limit = 100;
  const offset = (pages - 1) * limit;

  const querybuilder = supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log')
    .select(
      `
    *,
    calibration:calibration_id!inner (
      id,
      property_no,
      dept,
      factory,
      vendor,
      model,
      calibr_class,
      calibration_cost (
        id,
        cost
      )
    )
    `,
      { count: 'exact' }
    )
    .eq('status', 'Calibration');

  if (factory) {
    querybuilder.eq('factory', factory);
  }

  if (calibrationClass) {
    querybuilder.eq('calibration.calibr_class', calibrationClass);
  }

  if (dateType && startDate) {
    querybuilder.gte(dateType, startDate);
  }

  if (dateType && endDate) {
    querybuilder.lte(dateType, endDate);
  }
  if (paginate) {
    querybuilder.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await querybuilder.order('id', {
    ascending: true,
  });
  const totalPages = Math.ceil(count / limit);

  if (error) {
    throw new Error(error.message);
  }
  console.log(count, totalPages);

  return { data, count, totalPages };
}

export async function updateCalibrationLogPropertyNo(
  old_property_no,
  new_property_no,
  factory
) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log')
    .update({ property_no: new_property_no })
    .eq('property_no', old_property_no)
    .eq('factory', factory)
    .select('*');

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function updateCalibrationLogStatus(id, item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log')
    .update(item)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function deleteCalibrationLogFilesByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log_file')
    .delete()
    .in('id', ids)
    .select('*');

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function deleteCalibrationLog(id) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_log')
    .delete()
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}
