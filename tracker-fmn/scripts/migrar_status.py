#!/usr/bin/env python3
"""Migração única: renomeia os status dos ADs para o novo esquema de colunas."""
import os, json, urllib.request
from pathlib import Path

def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and '=' in line and not line.startswith('#'):
                    k, _, v = line.partition('=')
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            return
        cur = cur.parent

load_env()
URL = os.environ['SUPABASE_URL']
KEY = os.environ['SUPABASE_SERVICE_KEY']

MIGRATIONS = [
    ('fazendo-producao',    'fazendo'),
    ('fazendo-teste',       'fazendo'),
    ('fazendo-recorrencia', 'ativo'),
    ('feito-otimo',         'finalizado'),
    ('feito-mediano',       'arquivado'),
    ('feito-ruim',          'arquivado'),
]

def patch(old_status, new_status):
    body = json.dumps({'status': new_status}).encode()
    req = urllib.request.Request(
        f"{URL}/rest/v1/ads?status=eq.{old_status}",
        data=body, method='PATCH'
    )
    req.add_header('apikey', KEY)
    req.add_header('Authorization', f'Bearer {KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'return=minimal')
    with urllib.request.urlopen(req) as r:
        return r.status

for old, new in MIGRATIONS:
    st = patch(old, new)
    print(f"  {old} → {new}: HTTP {st}")

print("Migração concluída.")
