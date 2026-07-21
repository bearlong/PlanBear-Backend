import supabase from '../../configs/supabase.js';

export async function listNoticeMembers() {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calib_notice_man')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Fetch notice members failed: ${error.message}`);
  }
  return data || [];
}

export async function getAutoNoticeMemberWithUselevel() {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calib_notice_man')
    .select('factory, dept')
    .eq('use_level', '1')
    .order('factory', { ascending: true });

  if (error) {
    throw new Error(
      `Fetch auto notice members with use level failed: ${error.message}`
    );
  }
  return data || [];
}

export async function getNoticeMembersByFactoryDept(factory, dept) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calib_notice_man')
    .select('*')
    .eq('factory', factory)
    .eq('dept', dept)
    .order('factory', { ascending: true });

  if (error) {
    throw new Error(
      `Fetch auto notice members with factory and dept failed: ${error.message}`
    );
  }
  return data || [];
}

export async function findNoticeMember({
  username,
  factory,
  dept,
  use_level,
} = {}) {
  if (!username) return false;

  let queryBuilder = supabase
    .schema(process.env.DB_SCHEMA)
    .from('calib_notice_man')
    .select('id', { count: 'exact', head: true })
    .eq('username', username);

  if (factory) queryBuilder = queryBuilder.eq('factory', factory);
  if (dept) queryBuilder = queryBuilder.eq('dept', dept);
  if (use_level) queryBuilder = queryBuilder.eq('use_level', use_level);

  const { count, error } = await queryBuilder;
  if (error) throw error;

  return count > 0;
}

export async function insertNoticeMember(item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calib_notice_man')
    .insert([item])
    .select(`*`)
    .single();

  if (error) throw error;
  return data;
}

export async function updateNoticeMember(id, item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calib_notice_man')
    .update(item)
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNoticeMember(id) {
  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calib_notice_man')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function batchDeleteNoticeMember(items) {
  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from('calib_notice_man')
    .delete()
    .in('id', items);

  if (error) throw error;
}
