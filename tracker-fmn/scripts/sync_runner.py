#!/usr/bin/env python3
"""Runner do agendamento: cria pastas faltantes, organiza arquivos soltos,
sincroniza Drive → Supabase, puxa vendas Hotmart e insights do Meta Ads.
Registra o resultado de cada script na tabela sync_status (para a aba Sistema)."""
import subprocess, sys, os, json, time, urllib.request
from pathlib import Path
from datetime import datetime, timezone

base = Path(__file__).resolve().parent

def load_env():
    cur = base
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            return
        cur = cur.parent

load_env()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def record_status(script, status, message, duration_s):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    row = {
        "script": script, "status": status, "message": message[:500],
        "duration_s": round(duration_s, 1),
        "last_run": datetime.now(timezone.utc).isoformat(),
    }
    try:
        body = json.dumps([row]).encode()
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/sync_status?on_conflict=script",
            data=body, method="POST")
        req.add_header("apikey", SUPABASE_KEY)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Prefer", "resolution=merge-duplicates,return=minimal")
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"  (não consegui registrar status de {script}: {e})")

# Sincronizar = enxuto: só reconcilia vendas Hotmart. A indexação do Drive não
# roda mais aqui — nenhuma tela do Tracker depende de varredura periódica.
#
# drive_sync_pastas.py, drive_organizar.py e sync_drive.py retirados em
# 2026-07-08: indexavam o Drive pra popular media_files/media_drive_url, mas
# esse fluxo foi substituído pelo botão "Adicionar criativo" (por card,
# adicionar-criativo.py / adicionar-criativo-organico.py), que busca a pasta
# no Drive sob demanda, na hora que o material é anexado. Rodar a indexação
# periódica de novo não teria efeito prático (nada mais lê o resultado) e só
# consumia tempo/chamadas ao Drive à toa. Arquivos continuam no repositório,
# prontos pra rodar manualmente se precisar reindexar tudo de uma vez.
#
# sync_insights.py e aplicar_regras.py foram retirados desta lista em
# 2026-07-05: toda a lógica que ainda rodava aqui (status do Kanban com o Meta,
# agregados 3d/5d/máximo, permalinks, pausas automáticas, classificação) foi
# portada para a nuvem (Edge Functions kanban-sync + processar-pausas, cron via
# pg_cron). Rodar os dois lados juntos duplicaria pausas automáticas e chamadas
# ao Meta. Os arquivos continuam no repositório, prontos para rodar manualmente
# como fallback se a nuvem falhar — não precisam ser reincluídos aqui para isso.
#
# sync_recuperacao.py retirado em 2026-07-05: script quebrado por desenho (tenta
# escrever em recuperacao_vendas, que é uma VIEW somente leitura sobre vendas +
# abandono_carrinho) e inteiramente redundante — a mesma informação já chega em
# tempo real pelo webhook, sem precisar de nenhum sync. Card "Recuperação de
# Vendas" do painel nunca dependeu deste script.
for script in ["sync_hotmart.py"]:
    t0 = time.time()
    result = subprocess.run(
        [sys.executable, str(base / script)],
        cwd=str(base.parent),
        capture_output=True, text=True,
    )
    dur = time.time() - t0
    ok = result.returncode == 0
    # última linha não vazia da saída como mensagem
    out_lines = [l for l in (result.stdout or "").splitlines() if l.strip()]
    msg = out_lines[-1] if out_lines else (result.stderr or "")[-200:]
    record_status(script, "ok" if ok else "erro", msg, dur)
    print(f"[{script}] {'OK' if ok else 'ERRO'} em {dur:.1f}s — {msg[:80]}")
