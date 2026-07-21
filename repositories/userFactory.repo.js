import supabase from '../configs/supabase.js';

export async function getFactoryLists() {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('user_factory')
    .select('factory')
    .order('factory', { ascending: true });
  console.log(data);
  if (error) {
    throw new Error(`Fetch favorite failed: ${error.message}`);
  }
  return data || [];
}

export async function findUserFactoryByUsername(username) {
  const { count, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('user_factory_mapping')
    .select('username', { count: 'exact', head: true })
    .eq('username', username);

  if (error) throw error;
  return count > 0;
}

export async function getUserFactoryMappingByUsername(username) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('user_factory_mapping')
    .select('factory')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  return data; // null ??{ factory_code }
}

export async function getFactoryByUsernameFromView(username) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('v_user_factory_match')
    .select('factory')
    .eq('username', username)
    .limit(1);
  if (error) throw error;
  return data.length > 0 ? data[0] : null; // null ??{ factory_code, factory }
}

export async function insertUserFactoryMapping(item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('user_factory_mapping')
    .insert([item])
    .select('id')
    .single();

  if (error) throw error;
  return data;
}
