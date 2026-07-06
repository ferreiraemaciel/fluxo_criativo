#!/usr/bin/env python3
"""
Sync de insights do Meta Ads → Supabase, AGREGADO por criativo (ADS XXX).

Um mesmo criativo pode ter sido usado em várias campanhas/conjuntos/anúncios,
cada um com seu ad_id no Meta. Como todos seguem a convenção de nome "ADS XXX",
este script varre a conta inteira, agrupa os anúncios pelo número do ADS extraído
do nome, e SOMA gasto e vendas de todas as instâncias daquele criativo.

Para cada ADS, grava na tabela `ads`:
  - gasto_total, vendas_total, cpa_historico   (período máximo, ciclo de vida)
  - gasto_3d,    vendas_3d,    cpa_3d           (hoje + 2 dias anteriores)
  - gasto_5d,    vendas_5d,    cpa_5d           (hoje + 4 dias anteriores)

Também grava cada instância (ad_id) em `insights_cache` para a árvore
campanha > conjunto > anúncio da aba Tráfego.

Execução:
  python3 scripts/sync_insights.py          → só ADs ativos (status='ativo'), recorrente
  python3 scripts/sync_insights.py --all    → todos os ADs cadastrados, backfill único
"""
import os, sys, re, json, time, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timedelta, timezone

SYNC_ALL = "--all" in sys.argv

# ── Carregar .env ─────────────────────────────────────────────────────────────
def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            return
        cur = cur.parent

load_env()

FB_TOKEN     = os.environ.get("FB_ACCESS_TOKEN_PERMANENTE", "")
FB_ACCOUNT   = os.environ.get("FB_AD_ACCOUNT_ID", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not FB_TOKEN:   raise SystemExit("FB_ACCESS_TOKEN_PERMANENTE não encontrado no .env")
if not FB_ACCOUNT: raise SystemExit("FB_AD_ACCOUNT_ID não encontrado no .env")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY não encontrados no .env")

ADS_PATTERN = re.compile(r"ADS\s*0*(\d+)", re.IGNORECASE)

# ── Graph API ─────────────────────────────────────────────────────────────────
def graph_get_url(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            err = json.loads(body) if body else {}
            code = err.get("error", {}).get("code", 0)
            if code in (17, 4, 32, 613):  # rate limit
                wait = 60 * (attempt + 1)
                print(f"    Rate limit (code {code}), aguardando {wait}s...")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("Falhou após 4 tentativas")

def fetch_account_ad_insights(date_preset=None, since=None, until=None):
    """Busca insights de TODOS os anúncios da conta para um período (paginado).
    Retorna lista de dicts: ad_id, ad_name, spend, actions, campanha/conjunto."""
    base = f"https://graph.facebook.com/v21.0/act_{FB_ACCOUNT}/insights"
    params = {
        "level": "ad",
        "fields": "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,actions,action_values,impressions,clicks,unique_clicks",
        "limit": "500",
        "access_token": FB_TOKEN,
    }
    if date_preset:
        params["date_preset"] = date_preset
    else:
        params["time_range"] = json.dumps({"since": since, "until": until})

    rows = []
    url = f"{base}?{urllib.parse.urlencode(params)}"
    while url:
        resp = graph_get_url(url)
        rows.extend(resp.get("data", []))
        url = (resp.get("paging") or {}).get("next")
        if url:
            time.sleep(0.3)
    return rows

def extract_metric(d, action_type):
    for item in d.get("actions") or []:
        if item.get("action_type") == action_type:
            return int(float(item.get("value", 0)))
    return 0

def extract_value(d, action_type):
    for item in d.get("action_values") or []:
        if item.get("action_type") == action_type:
            return float(item.get("value", 0))
    return 0.0

def purchases_of(d):
    return extract_metric(d, "purchase") or extract_metric(d, "offsite_conversion.fb_pixel_purchase")

def purchase_value_of(d):
    return extract_value(d, "purchase") or extract_value(d, "offsite_conversion.fb_pixel_purchase")

# ── Supabase ──────────────────────────────────────────────────────────────────
def fetch_supabase(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def supabase_upsert(table, rows, conflict_cols):
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={','.join(conflict_cols)}"
    body = json.dumps(rows).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates,return=minimal")
    with urllib.request.urlopen(req) as r:
        return r.status

def supabase_patch(table, filter_col, filter_val, payload):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{filter_col}=eq.{filter_val}"
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="PATCH")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    with urllib.request.urlopen(req) as r:
        return r.status

# ── Datas ─────────────────────────────────────────────────────────────────────
def date_range(days_back):
    today = datetime.now(timezone.utc).date()
    since = today - timedelta(days=days_back - 1)
    return str(since), str(today)

# ── Gasto diário da conta (para o filtro de período do dashboard) ─────────────
def fetch_ad_permalink(meta_ad_id):
    """Busca o permalink do post vinculado ao anúncio.
    Monta a URL a partir do effective_object_story_id (page_id_post_id)
    sem precisar da permissão pages_read_engagement."""
    try:
        url = f"https://graph.facebook.com/v25.0/{meta_ad_id}?fields=creative%7Beffective_object_story_id%7D&access_token={FB_TOKEN}"
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read())
        story_id = data.get("creative", {}).get("effective_object_story_id")
        if not story_id or "_" not in story_id:
            return None
        page_id, post_id = story_id.split("_", 1)
        return f"https://www.facebook.com/permalink/story?story_fbid={post_id}&id={page_id}"
    except Exception as e:
        print(f"  Aviso: não foi possível buscar permalink para {meta_ad_id}: {e}")
        return None

def sync_ad_permalinks(best_ad_id):
    """Atualiza meta_ad_url em ads com o permalink do anúncio de melhor gasto."""
    ok = 0; skip = 0
    for num, (meta_ad_id, _) in best_ad_id.items():
        permalink = fetch_ad_permalink(meta_ad_id)
        if not permalink:
            skip += 1
            continue
        try:
            supabase_patch("ads", "numero", num, {"meta_ad_url": permalink})
            ok += 1
        except Exception as e:
            print(f"  Erro ao salvar permalink ADS {num}: {e}")
            skip += 1
    print(f"  Permalinks salvos: {ok} | ignorados/erros: {skip}")

def sync_gasto_diario(dias=60):
    """Busca o gasto da conta dia a dia (time_increment=1) e grava em gasto_diario.
    Permite ao dashboard somar o gasto exato do período filtrado (hoje, 7d, 30d...)."""
    until = datetime.now(timezone.utc).date()
    since = until - timedelta(days=dias - 1)
    base = f"https://graph.facebook.com/v21.0/act_{FB_ACCOUNT}/insights"
    params = {
        "fields": "spend,actions",
        "level": "account",
        "time_increment": "1",
        "time_range": json.dumps({"since": str(since), "until": str(until)}),
        "limit": "200",
        "access_token": FB_TOKEN,
    }
    url = f"{base}?{urllib.parse.urlencode(params)}"
    rows = []
    while url:
        resp = graph_get_url(url)
        rows.extend(resp.get("data", []))
        url = (resp.get("paging") or {}).get("next")
        if url:
            time.sleep(0.3)

    diario = []
    for d in rows:
        diario.append({
            "data":    d.get("date_start"),
            "gasto":   round(float(d.get("spend", 0) or 0), 2),
            "compras": purchases_of(d),
            "cliques": extract_metric(d, "link_click"),
            "lp_views": extract_metric(d, "landing_page_view"),
            "initiate_checkout": extract_metric(d, "initiate_checkout")
                                 or extract_metric(d, "offsite_conversion.fb_pixel_initiate_checkout"),
        })
    if diario:
        for i in range(0, len(diario), 100):
            supabase_upsert("gasto_diario", diario[i:i+100], ["data"])
    print(f"  {len(diario)} dias de gasto gravados em gasto_diario.")

# ── Sincronizar status ativo/pausado do Meta → tabela ads ────────────────────
def sync_meta_ad_status():
    """Busca todos os ads ATIVOS no Meta e atualiza a tabela local ads.
    O Meta é a fonte da verdade: ads ativos no Meta ficam com status='ativo',
    ads que estavam ativos localmente mas não estão mais no Meta ficam 'pausado'.
    Novos ads com padrão ADS XXX são inseridos automaticamente."""
    base = f"https://graph.facebook.com/v21.0/act_{FB_ACCOUNT}/ads"
    params = {
        "fields": "id,name,effective_status",
        "effective_status": '["ACTIVE","IN_PROCESS","PENDING_REVIEW"]',
        "limit": "500",
        "access_token": FB_TOKEN,
    }
    url = f"{base}?{urllib.parse.urlencode(params)}"
    meta_active = []
    while url:
        resp = graph_get_url(url)
        meta_active.extend(resp.get("data", []))
        url = (resp.get("paging") or {}).get("next")
        if url:
            time.sleep(0.2)

    print(f"  {len(meta_active)} ads ativos/em revisão no Meta.")

    # Extrai número e título de cada ad com padrão ADS XXX
    novos = {}  # num → {meta_ad_id, titulo}
    for d in meta_active:
        nome = d.get("name", "") or ""
        m = ADS_PATTERN.search(nome)
        if not m:
            continue
        num = int(m.group(1))
        clean = re.sub(r'^.*?ADS\s*0*\d+\s*[-–]?\s*', '', nome, flags=re.IGNORECASE).strip() or nome
        # Se o mesmo ADS aparece em várias campanhas, fica com o que veio primeiro
        if num not in novos:
            novos[num] = {"numero": num, "meta_ad_id": d["id"], "titulo": clean, "status": "ativo", "tipo": "reels"}

    if novos:
        rows = list(novos.values())
        for i in range(0, len(rows), 100):
            supabase_upsert("ads", rows[i:i+100], ["numero"])
        print(f"  {len(rows)} ADS upsertados como ativos (fonte: Meta).")

    # Ads que estavam ativos localmente mas não estão mais no Meta → inativo
    # Usamos 'inativo' para não conflitar com possíveis constraints de enum no DB
    ativos_locais = fetch_supabase("ads?select=numero,meta_ad_id&status=eq.ativo&limit=2000")
    nums_meta_ativo = set(novos.keys())
    for a in ativos_locais:
        if a["numero"] not in nums_meta_ativo:
            # Tenta 'pausado' primeiro; se falhar, tenta 'inativo'; se falhar, ignora silenciosamente
            for novo_status in ("pausado", "inativo", "arquivado"):
                try:
                    supabase_patch("ads", "numero", a["numero"], {"status": novo_status})
                    print(f"  ADS {a['numero']} marcado como {novo_status} (não ativo no Meta).")
                    break
                except Exception:
                    continue
            else:
                print(f"  Aviso: ADS {a['numero']} não está ativo no Meta mas não foi possível atualizar status.")

    return nums_meta_ativo


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    # 1. Sincronizar status dos ads com o Meta (fonte da verdade)
    print("Sincronizando status de ads com o Meta...")
    target_nums = sync_meta_ad_status()
    print(f"  {len(target_nums)} ADs ativos no Meta como alvo.")
    if not target_nums:
        print("  Nenhum ad ativo no Meta. Encerrando.")
        return

    since_3d, until_3d = date_range(3)
    since_5d, until_5d = date_range(5)

    # 1.5. Gasto diário da conta — aposentado em 2026-07-04: a Edge Function
    # meta-sync (escopo "curtas", cron a cada 6h) já mantém gasto_diario fresco
    # direto na nuvem, sem depender deste script rodando no Mac. Se a nuvem tiver
    # algum problema, descomente a linha abaixo para retomar o fallback local.
    # try:
    #     sync_gasto_diario(60)
    # except Exception as e:
    #     print(f"  Aviso: falha no gasto diário: {e}")

    # 2. Varrer a conta inteira, 4 períodos
    print("Varrendo insights da conta (período máximo)...")
    rows_max = fetch_account_ad_insights(date_preset="maximum")
    print(f"  {len(rows_max)} anúncios no período máximo.")
    print("Varrendo insights da conta (3 dias)...")
    rows_3d = fetch_account_ad_insights(since=since_3d, until=until_3d)
    print("Varrendo insights da conta (5 dias)...")
    rows_5d = fetch_account_ad_insights(since=since_5d, until=until_5d)
    print("Varrendo insights da conta (hoje)...")
    rows_hoje = fetch_account_ad_insights(date_preset="today")
    print(f"  {len(rows_hoje)} anúncios com gasto hoje.")

    # 3. Agregar por número de ADS (extraído do nome)
    # agg[numero] = { 'max': {gasto,vendas,valor}, '3d': {...}, '5d': {...}, 'hoje': {...} }
    # best_ad_id[numero] = meta_ad_id mais recente (3d > 5d > max), para atualizar ads table
    agg = {}
    cache_rows = []   # instâncias para insights_cache (máximo + 3d + 5d + hoje)
    best_ad_id = {}   # num → meta_ad_id com maior gasto no período mais recente

    def accumulate(rows, key, periodo, save_cache=False, track_best=False):
        for d in rows:
            nome = d.get("ad_name", "") or ""
            m = ADS_PATTERN.search(nome)
            if not m:
                continue
            num = int(m.group(1))
            if num not in target_nums:
                continue
            gasto  = float(d.get("spend", 0) or 0)
            vendas = purchases_of(d)
            valor  = purchase_value_of(d)
            impr   = int(d.get("impressions", 0) or 0)
            slot = agg.setdefault(num, {"max": [0,0,0], "3d": [0,0,0], "5d": [0,0,0], "hoje": [0,0,0]})
            slot[key][0] += gasto
            slot[key][1] += vendas
            slot[key][2] += valor
            # Registra o meta_ad_id com maior gasto neste período (instância principal)
            if track_best and gasto > 0:
                cur_best = best_ad_id.get(num)
                if cur_best is None or gasto > cur_best[1]:
                    best_ad_id[num] = (d.get("ad_id"), gasto)
            if save_cache:
                cache_rows.append({
                    "meta_ad_id":         d.get("ad_id"),
                    "meta_ad_name":       nome,
                    "meta_adset_id":      d.get("adset_id"),
                    "meta_adset_name":    d.get("adset_name"),
                    "meta_campaign_id":   d.get("campaign_id"),
                    "meta_campaign_name": d.get("campaign_name"),
                    "periodo":            periodo,
                    "data_fim":           str(datetime.now(timezone.utc).date()),
                    "gasto":              round(gasto, 2),
                    "compras":            vendas,
                    "valor_compras":      round(valor, 2),
                    "impressoes":         impr,
                    "cliques":            int(d.get("clicks", 0) or 0),
                    "link_clicks":        int(d.get("unique_clicks", 0) or 0),
                    "cpa":                round(gasto / vendas, 2) if vendas > 0 else None,
                    "roas":               round(valor / gasto, 4) if gasto > 0 else None,
                    "cpm":                round(gasto / impr * 1000, 2) if impr > 0 else None,
                })

    # Período 3d tem prioridade para best_ad_id (mais recente e ativo)
    accumulate(rows_3d,   "3d",   "3d",      save_cache=True, track_best=True)
    accumulate(rows_5d,   "5d",   "5d",      save_cache=True, track_best=True)
    accumulate(rows_max,  "max",  "maximum", save_cache=True)
    accumulate(rows_hoje, "hoje", "hoje",    save_cache=True)

    print(f"  {len(agg)} ADS com dados agregados.")

    # 4. Gravar instâncias em insights_cache — aposentado em 2026-07-04: a Edge
    # Function meta-sync (nuvem) já escreve isso a cada 6h (curtas) e 1x/dia
    # (maximo), com a lógica de "anúncio ativo" correta (direto do Meta, não do
    # status do Kanban). Escrever aqui também não quebra nada (upsert idempotente),
    # mas é redundante. Se a nuvem tiver problema, descomente para retomar o
    # fallback local — os dados acima (rows_max/3d/5d/hoje, cache_rows) já estão
    # prontos, só reativar a escrita.
    # if cache_rows:
    #     print(f"Salvando {len(cache_rows)} instâncias em insights_cache...")
    #     for i in range(0, len(cache_rows), 100):
    #         supabase_upsert("insights_cache", cache_rows[i:i+100], ["meta_ad_id", "periodo"])

    # 5. Gravar totais agregados na tabela ads
    print("Atualizando totais agregados na tabela ads...")
    ok = 0; erros = 0
    for num, slot in agg.items():
        g_max,  v_max,  _ = slot["max"]
        g_3d,   v_3d,   _ = slot["3d"]
        g_5d,   v_5d,   _ = slot["5d"]
        g_hoje, v_hoje, _ = slot.get("hoje", [0,0,0])
        payload = {
            "gasto_total":   round(g_max, 2),
            "vendas_total":  v_max,
            "cpa_historico": round(g_max / v_max, 2) if v_max > 0 else None,
            "gasto_3d":      round(g_3d, 2),
            "vendas_3d":     v_3d,
            "cpa_3d":        round(g_3d / v_3d, 2) if v_3d > 0 else None,
            "gasto_5d":      round(g_5d, 2),
            "vendas_5d":     v_5d,
            "cpa_5d":        round(g_5d / v_5d, 2) if v_5d > 0 else None,
        }
        # Atualiza meta_ad_id para a instância mais ativa (3d > 5d) — garante filtro correto no frontend
        if num in best_ad_id:
            payload["meta_ad_id"] = best_ad_id[num][0]
        try:
            supabase_patch("ads", "numero", num, payload)
            ok += 1
        except Exception as e:
            print(f"  Erro ao atualizar ADS {num}: {e}")
            erros += 1

    print(f"\n{'='*50}")
    print(f"Concluído.")
    print(f"  ADS atualizados:        {ok}")
    print(f"  Instâncias no cache:    {len(cache_rows)}")
    print(f"  Erros:                  {erros}")

    # 6. Buscar permalink do anúncio mais rentável e salvar em meta_ad_url
    print("\nBuscando permalinks dos anúncios no Facebook...")
    sync_ad_permalinks(best_ad_id)

def _classificar_ad(vendas, cpa, gasto):
    """Espelho de classifyAd() do kanban.jsx — regras aprovadas 2026-06-20.
    Ótimo:            >= 5 vendas E CPA < R$297
    Mediano:          1 a 4 vendas — OU — >= 5 vendas com CPA >= R$297
    Testar novamente: 0 vendas E gasto >= R$145,53
    Ruim:             0 vendas E gasto < R$145,53
    """
    TICKET        = 297.0
    GASTO_MIN_TEST = 145.53
    v = vendas or 0
    g = gasto  or 0
    c = cpa if cpa is not None else (g / v if v > 0 and g > 0 else None)
    if v == 0:
        return "Testar novamente" if g >= GASTO_MIN_TEST else "Ruim"
    if v >= 5 and (c is None or c < TICKET):
        return "Ótimo"
    return "Mediano"

def _buscar_insights_ad(meta_ad_id):
    """Retorna dict com compras, cpa, gasto do insights_cache (periodo='maximum')."""
    url = (f"{SUPABASE_URL}/rest/v1/insights_cache"
           f"?meta_ad_id=eq.{meta_ad_id}&periodo=eq.maximum"
           f"&select=compras,cpa,gasto&limit=1")
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req, timeout=10) as r:
        rows = json.loads(r.read())
    return rows[0] if rows else {}

def _supabase_patch(path, body_dict):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    body = json.dumps(body_dict).encode()
    req = urllib.request.Request(url, data=body, method="PATCH")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    urllib.request.urlopen(req)

def processar_pausas_pendentes():
    """Lê alertas com acao_pendente='pausar' e executa PAUSED no Meta Ads."""
    from datetime import date
    url = (f"{SUPABASE_URL}/rest/v1/alertas"
           f"?acao_pendente=eq.pausar&resolvido=eq.false"
           f"&select=id,meta_ad_id,ads_numero,regra_codigo")
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req) as r:
        pendentes = json.loads(r.read())

    if not pendentes:
        print("  Nenhuma pausa pendente.")
        return

    print(f"  {len(pendentes)} pausa(s) pendente(s) para processar.")
    hoje = date.today().strftime("%d/%m/%Y")

    for row in pendentes:
        ad_id    = row.get("meta_ad_id")
        ads_num  = row.get("ads_numero")
        alerta_id = row.get("id")
        regra    = row.get("regra_codigo", "?")
        if not ad_id:
            print(f"  ADS {ads_num}: sem meta_ad_id, pulando.")
            continue
        try:
            # 1. Pausa o anúncio no Meta
            pause_url = f"https://graph.facebook.com/v25.0/{ad_id}?access_token={FB_TOKEN}"
            body = urllib.parse.urlencode({"status": "PAUSED"}).encode()
            req_pause = urllib.request.Request(pause_url, data=body, method="POST")
            req_pause.add_header("Content-Type", "application/x-www-form-urlencoded")
            with urllib.request.urlopen(req_pause, timeout=15) as r:
                result = json.loads(r.read())

            if not result.get("success"):
                print(f"  ADS {ads_num}: Meta retornou {result}")
                continue

            print(f"  ADS {ads_num} ({ad_id}): pausado no Meta.")

            # 2. Busca métricas para classificar o criativo
            ins = _buscar_insights_ad(ad_id)
            vendas = ins.get("compras") or 0
            cpa    = ins.get("cpa")
            gasto  = ins.get("gasto") or 0
            classificacao = _classificar_ad(vendas, cpa, gasto)

            # 3. Monta nota de pausa automática
            nota_pausa = f"[Pausado automaticamente — {regra} em {hoje}. Classificação: {classificacao}]"

            # 4. Busca observacoes atuais para não sobrescrever
            obs_url = (f"{SUPABASE_URL}/rest/v1/ads"
                       f"?numero=eq.{ads_num}&select=observacoes")
            req_obs = urllib.request.Request(obs_url)
            req_obs.add_header("apikey", SUPABASE_KEY)
            req_obs.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
            with urllib.request.urlopen(req_obs, timeout=10) as r:
                obs_rows = json.loads(r.read())
            obs_atual = (obs_rows[0].get("observacoes") or "") if obs_rows else ""
            obs_nova = f"{obs_atual}\n{nota_pausa}".strip()

            # 5. Determina coluna destino no Kanban pela classificação
            col_destino = {
                "Ótimo":            "campeoes",
                "Testar novamente": "testar-novamente",
                "Mediano":          "arquivado",
                "Ruim":             "arquivado",
            }.get(classificacao, "arquivado")

            ads_patch = {
                "status": col_destino,
                "tag":    classificacao,
                "observacoes": obs_nova,
            }
            if vendas:
                ads_patch["vendas_total"] = vendas
            if cpa:
                ads_patch["cpa_historico"] = cpa
            if gasto:
                ads_patch["gasto_total"] = gasto

            _supabase_patch(f"ads?numero=eq.{ads_num}", ads_patch)
            print(f"  ADS {ads_num}: arquivado no Kanban como '{classificacao}'.")

            # 6. Marca alerta como resolvido
            _supabase_patch(f"alertas?id=eq.{alerta_id}",
                            {"resolvido": True, "acao_pendente": None})

        except Exception as e:
            print(f"  Erro ao pausar ADS {ads_num}: {e}")

if __name__ == "__main__":
    print("\n── Processando pausas pendentes ──────────────────────────")
    processar_pausas_pendentes()
    print("\n── Sync de insights ──────────────────────────────────────")
    main()
