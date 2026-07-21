import supabase from '../../configs/supabase.js';

export async function getCalibrationLists(query = '', system = '', page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;

  let queryBuilder = supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_list')
    .select('id, instru_name, system');
  if (query) {
    queryBuilder = queryBuilder.or(`instru_name.ilike.%${query}%`);
  }
  if (system) {
    queryBuilder = queryBuilder.eq('system', system);
  }
  queryBuilder = queryBuilder.range(offset, offset + limit - 1);
  queryBuilder = queryBuilder.order('id', { ascending: true });
  const { data, error, count } = await queryBuilder;
  const totalPages = Math.ceil(count / limit);
  if (error) {
    return { status: 'error', message: error.message };
  }
  return { data, count, totalPages };
}

// export async function getAllInstrumentSystems() {
//   const { data, error } = await supabase
//     .schema(process.env.DB_SCHEMA)
//     .from('instrument_systems')
//     .select('system_name, description')
//     .order('system_name', { ascending: true });
//   if (error) {
//     return { status: 'error', message: error.message };
//   }
//   return data;
// }

export async function getInstrumentByid(id) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_list')
    .select('id, instru_name, system')
    .eq('id', id)
    .single();
  if (error) {
    return { status: 'error', message: error.message };
  }
  return { status: 'success', data };
}

export async function addCalibrationLists(instru_name, system) {
  const { count, error: dupErr } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_list')
    .select('instru_name', { count: 'exact', head: true })
    .eq('instru_name', instru_name);

  if (dupErr) {
    return { status: 'error', code: 'SERVER_ERROR', message: dupErr.message };
  }
  if (count > 0) {
    return {
      status: 'error',
      code: 'DUPLICATE',
      message: 'Instrument already exists',
    };
  }

  const uploadData = {
    instru_name,
    system,
  };
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_list')
    .insert([uploadData])
    .select('id')
    .single();
  console.log('data:', data);
  if (error) {
    return { status: 'error', message: error.message };
  }
  return {
    status: 'success',
    message: 'Instrument system added successfully',
    data: data,
  };
}

export async function updateCalibrationList(id, instru_name, system) {
  const uploadData = {
    instru_name,
    system,
  };
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_list')
    .update(uploadData)
    .eq('id', id)
    .select('id')
    .single();
  if (error) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'success',
    message: 'Calibration list item updated successfully',
    data: data,
  };
}

export async function deleteCalibrationList(id) {
  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_list')
    .delete()
    .eq('id', id);
  if (error) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'success',
    message: 'Calibration list item deleted successfully',
  };
}
