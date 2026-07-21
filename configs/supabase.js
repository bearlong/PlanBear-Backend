import { createClient } from '@supabase/supabase-js';

const supabaseKey = process.env.SUPABASE_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const isMock = process.env.USE_MOCK === 'true';
let supabase = null;
if (isMock) {
  console.log('✅ Using mock Supabase client');
}else {
     supabase = createClient(supabaseUrl, supabaseKey);

}


export default supabase;
