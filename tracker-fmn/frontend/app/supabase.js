/* ================================================================
   Tracker FMN — Supabase Client
   ================================================================ */
const SUPABASE_URL = 'https://wntzzzuqoqmfcjebmzul.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eknjN5BlmwD9_H6kDUtuPw_ejoa8rwx';

const { createClient } = supabase;
window.db = createClient(SUPABASE_URL, SUPABASE_KEY);
window.db.supabaseUrl = SUPABASE_URL;
window.db.supabaseKey = SUPABASE_KEY;

/* Token da sessão logada, usado nas chamadas às Edge Functions.
   Desde a auditoria de 12/09/2026 as funções da nuvem exigem sessão de
   verdade (ou chave de serviço). A chave pública acima serve para as
   leituras do banco, não serve mais como senha das funções. Começa com a
   chave pública só para não quebrar chamada feita antes do login subir. */
window.tokenTracker = SUPABASE_KEY;
window.db.auth.getSession().then(({ data }) => {
  if (data?.session?.access_token) window.tokenTracker = data.session.access_token;
});
window.db.auth.onAuthStateChange((_evento, sessao) => {
  window.tokenTracker = sessao?.access_token || SUPABASE_KEY;
});
