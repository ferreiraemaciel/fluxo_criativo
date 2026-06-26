/* ================================================================
   Tracker FMN — Auth Module
   Login com Supabase Auth. Local (localhost) pula o login.
   Apenas contato@ferreiraemaciel.com.br tem acesso.
   ================================================================ */
const _AUTH_URL  = 'https://wntzzzuqoqmfcjebmzul.supabase.co';
const _AUTH_KEY  = 'sb_publishable_eknjN5BlmwD9_H6kDUtuPw_ejoa8rwx';
const _AUTH_EMAIL_ALLOWED = 'contato@ferreiraemaciel.com.br';
const _AUTH_SESSION_KEY   = 'fmn_tracker_token';

window.FMNAuth = {
  isLocal() {
    return ['localhost', '127.0.0.1'].includes(location.hostname);
  },

  getToken() {
    return sessionStorage.getItem(_AUTH_SESSION_KEY);
  },

  setToken(t) {
    sessionStorage.setItem(_AUTH_SESSION_KEY, t);
  },

  clear() {
    sessionStorage.removeItem(_AUTH_SESSION_KEY);
  },

  async verify() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const r = await fetch(`${_AUTH_URL}/auth/v1/user`, {
        headers: { apikey: _AUTH_KEY, Authorization: `Bearer ${token}` }
      });
      const u = await r.json();
      return u?.email === _AUTH_EMAIL_ALLOWED;
    } catch { return false; }
  },

  async login(email, password) {
    if (email.trim().toLowerCase() !== _AUTH_EMAIL_ALLOWED) {
      throw new Error('Este e-mail não tem permissão de acesso.');
    }
    const r = await fetch(`${_AUTH_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: _AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    });
    const d = await r.json();
    if (!d.access_token) {
      throw new Error(d.error_description || 'E-mail ou senha incorretos.');
    }
    this.setToken(d.access_token);
    return d;
  },

  logout() {
    this.clear();
    location.reload();
  },

  /* Roda ao carregar a página. Mostra login ou libera o app. */
  async init() {
    if (this.isLocal()) {
      document.getElementById('loginScreen')?.remove();
      return;
    }
    const ok = await this.verify();
    if (ok) {
      document.getElementById('loginScreen')?.remove();
    } else {
      document.getElementById('loginScreen').style.display = 'flex';
    }
  }
};
