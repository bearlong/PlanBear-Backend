import supabase from '../../configs/supabase.js';

export async function getInstrumentSystems() {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('instrument_systems')
    .select('system_name, description')
    .eq('is_deleted', false)
    .order('system_name', { ascending: true });
  if (error) {
    return { status: 'error', message: error.message };
  }
  return data;
}

export async function getAllInstrumentSystems() {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('instrument_systems')
    .select('system_name, description')
    .order('system_name', { ascending: true });
  if (error) {
    return { status: 'error', message: error.message };
  }
  return data;
}

export async function addInstrumentSystem(system_name, description) {
  const { count, error: dupErr } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('instrument_systems')
    .select('system_name', { count: 'exact', head: true })
    .eq('system_name', system_name);

  if (dupErr) {
    return { status: 'error', message: dupErr.message };
  }

  if (count > 0) {
    return { status: 'success', message: 'Already exists' };
  }

  const uploadData = {
    system_name,
    description,
    is_deleted: false,
  };
  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('instrument_systems')
    .insert([uploadData]);
  if (error) {
    return { status: 'error', message: error.message };
  }
  return { status: 'success', message: 'Instrument system added successfully' };
}
