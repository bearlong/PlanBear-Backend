import supabase from '../configs/supabase.js';

export async function getUserByUsernames(usernames) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('b_user')
    .select('*')
    .in('username', usernames);

  if (error) {
    throw new Error(`Fetch users failed: ${error.message}`);
  }
  return data;
}

export async function getInfoByUsernames(usernames, columns = '*') {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('b_user')
    .select(columns)
    .in('username', usernames);

  if (error) {
    throw new Error(`Fetch users failed: ${error.message}`);
  }

  return data || [];
}

export async function getUserByFullnames(fullnames, columns = '*') {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('b_user')
    .select(columns)
    .in('fullname', fullnames);

  if (error) {
    throw new Error(`Fetch users failed: ${error.message}`);
  }

  return data || [];
}
