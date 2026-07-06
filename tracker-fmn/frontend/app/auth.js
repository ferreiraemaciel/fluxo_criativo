/* ================================================================
   Tracker FMN — Auth Module v2
   Login REAL via Supabase Auth: a sessão é anexada ao window.db,
   então as leituras vão como usuário autenticado (não mais anon).
   A aplicação só monta depois da sessão confirmada.
   Apenas contato@ferreiraemaciel.com.br tem acesso.
   ================================================================ */
const _AUTH_EMAIL_ALLOWED = 'contato@ferreiraemaciel.com.br';

window.FMNAuth = {
  async session() {
    try { const { data } = await window.db.auth.getSession(); return data.session; }
    catch { return null; }
  },

  async login(email, password) {
    if (email.trim().toLowerCase() !== _AUTH_EMAIL_ALLOWED) {
      throw new Error('Este e-mail não tem permissão de acesso.');
    }
    const { data, error } = await window.db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      throw new Error(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message);
    }
    return data;
  },

  async logout() {
    try { await window.db.auth.signOut(); } catch {}
    location.reload();
  },

  /* Mostra a aplicação (monta o React) e remove a tela de login. */
  mount() {
    window.__trackerAuthed = true;
    if (window.__renderTracker) window.__renderTracker();
    document.getElementById('loginScreen')?.remove();
  },

  /* Roda ao carregar a página. */
  async init() {
    const s = await this.session();
    if (s && s.user && s.user.email === _AUTH_EMAIL_ALLOWED) {
      this.mount();
    } else {
      const ls = document.getElementById('loginScreen');
      if (ls) ls.style.display = 'flex';
    }
  }
};
