/* ================================================================
   Tracker FMN — Supabase Client
   ================================================================ */
const SUPABASE_URL = 'https://wntzzzuqoqmfcjebmzul.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eknjN5BlmwD9_H6kDUtuPw_ejoa8rwx';

const { createClient } = supabase;
window.db = createClient(SUPABASE_URL, SUPABASE_KEY);
window.db.supabaseUrl = SUPABASE_URL;
window.db.supabaseKey = SUPABASE_KEY;
