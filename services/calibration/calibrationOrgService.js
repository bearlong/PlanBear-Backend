import supabase from '../../configs/supabase.js';

export async function getCalibrationOrg(query = '', page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  let queryBuilder = supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_org')
    .select('*', { count: 'exact' });
  if (query) {
    queryBuilder = queryBuilder.or(`name.ilike.%${query}%`);
  }
  queryBuilder = queryBuilder.range(offset, offset + limit - 1);
  queryBuilder = queryBuilder.order('name', { ascending: true });
  const { data, error, count } = await queryBuilder;
  const totalPages = Math.ceil(count / limit);
  if (error) {
    return { status: 'error', message: error.message };
  }
  return { data, count, totalPages };
}

export async function addCalibrationOrg(item) {
  const { name } = item;
  const { count, error: dupErr } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_org')
    .select('name', { count: 'exact', head: true })
    .eq('name', name);

  if (dupErr) {
    return { status: 'error', code: 'SERVER_ERROR', message: dupErr.message };
  }
  if (count > 0) {
    return {
      status: 'error',
      code: 'DUPLICATE',
      message: 'Org already exists',
    };
  }

  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_org')
    .insert([item])
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

export async function updateCalibrationOrg(id, item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_org')
    .update(item)
    .eq('id', id)
    .select('id')
    .single();
  if (error) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'success',
    message: 'Calibration org item updated successfully',
    data: data,
  };
}

export async function deleteCalibrationOrg(id) {
  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calibration_org')
    .delete()
    .eq('id', id);
  if (error) {
    return { status: 'error', message: error.message };
  }

  return {
    status: 'success',
    message: 'Calibration org item deleted successfully',
  };
}
