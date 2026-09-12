// Tracker FMN — portão único das Edge Functions.
//
// Nasceu da auditoria de 12/09/2026: dez funções respondiam a qualquer pessoa
// da internet, inclusive a meta-criar-ad, que cria campanha com orçamento na
// conta real do Meta. As funções continuam publicadas com --no-verify-jwt
// (o cron do banco chama sem JWT e a chave pública da tela não é JWT), então
// a trava é esta aqui dentro, e não no portão do Supabase.
//
// Três chaves abrem a porta:
//   1. chave de serviço no Authorization (rotinas e scripts)
//   2. x-cron-secret (pg_cron chamando via pg_net, segredo guardado no Vault)
//   3. sessão de usuário logado no Tracker (só quando a função aceita usuário)

const URL_SUPA      = Deno.env.get("SUPABASE_URL") || "";
const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CHAVE_ANON    = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SEGREDO_CRON  = (Deno.env.get("CRON_SECRET") || "").trim();

function tokenDoPedido(req: Request) {
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

export function ehServico(req: Request) {
  const t = tokenDoPedido(req);
  return !!t && !!CHAVE_SERVICO && t === CHAVE_SERVICO;
}

export function ehCron(req: Request) {
  const s = (req.headers.get("x-cron-secret") || "").trim();
  return !!SEGREDO_CRON && s === SEGREDO_CRON;
}

// Confirma a sessão no próprio Supabase. Devolve o e-mail quando vale.
export async function usuarioDoPedido(req: Request): Promise<string | null> {
  const token = tokenDoPedido(req);
  if (!token || token === CHAVE_ANON || token.startsWith("sb_publishable_")) return null;
  try {
    const r = await fetch(`${URL_SUPA}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: CHAVE_ANON },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.email || null;
  } catch {
    return null;
  }
}

type Opcoes = { usuario?: boolean; cabecalhos?: Record<string, string> };

// Devolve null quando pode passar, ou a resposta de recusa quando não pode.
export async function portao(req: Request, opcoes: Opcoes = {}): Promise<Response | null> {
  if (ehServico(req) || ehCron(req)) return null;
  if (opcoes.usuario && (await usuarioDoPedido(req))) return null;
  return new Response(JSON.stringify({ erro: "sem permissão" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...(opcoes.cabecalhos || {}) },
  });
}
