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

for script in ["drive_sync_pastas.py", "drive_organizar.py", "sync_drive.py", "sync_insights.py", "aplicar_regras.py"]:
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
