#!/usr/bin/env python3
"""Servidor estático local do Tracker FMN com cache desabilitado.
Expõe também POST /api/sync para rodar sync_runner.py sob demanda."""
import http.server
import socketserver
import subprocess
import json
import os
import threading
from urllib.parse import urlparse, parse_qs

PORT = 3030
ROOT = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(os.path.dirname(ROOT), "scripts")
SYNC_SCRIPT     = os.path.join(SCRIPTS, "sync_runner.py")
VIDEO_SCRIPT    = os.path.join(SCRIPTS, "otimizar-video-r2.py")
CRIATIVO_SCRIPT = os.path.join(SCRIPTS, "preparar-criativo-meta.py")
ADICIONAR_SCRIPT = os.path.join(SCRIPTS, "adicionar-criativo.py")

# Estado da otimização de vídeo (Fluxo A, batch)
VIDEO_STATUS = {"running": False, "total": 0, "done": 0, "msg": "", "error": None}
# Estado da preparação de criativo pro Meta (Fluxo B, por card)
CRIATIVO_STATUS = {"running": False, "numero": None, "video_id": None, "error": None, "msg": ""}
# Estado do "Adicionar criativo" (Fluxo A, por card, gera o preview)
ADD_STATUS = {"running": False, "numero": None, "tipo": None, "done": False, "error": None, "msg": ""}

class TrackerHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/otimizar-videos":
            self._json(200, VIDEO_STATUS)
        elif path == "/api/preparar-criativo-meta":
            self._json(200, CRIATIVO_STATUS)
        elif path == "/api/adicionar-criativo":
            self._json(200, ADD_STATUS)
        else:
            super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/sync":
            self._run_sync()
        elif path == "/api/otimizar-videos":
            self._run_videos()
        elif path == "/api/preparar-criativo-meta":
            qs = parse_qs(urlparse(self.path).query)
            numero = (qs.get("numero") or [None])[0]
            self._run_criativo(numero)
        elif path == "/api/adicionar-criativo":
            qs = parse_qs(urlparse(self.path).query)
            numero = (qs.get("numero") or [None])[0]
            pasta  = (qs.get("pasta") or [None])[0]
            self._run_adicionar(numero, pasta)
        else:
            self.send_error(404)

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def _run_videos(self):
        if VIDEO_STATUS["running"]:
            self._json(202, VIDEO_STATUS)
            return

        def run():
            VIDEO_STATUS.update(running=True, total=0, done=0, msg="Iniciando…", error=None)
            try:
                proc = subprocess.Popen(
                    ["python3", VIDEO_SCRIPT, "--todos"],
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, cwd=SCRIPTS, env={**os.environ, "PYTHONWARNINGS": "ignore"})
                for line in proc.stdout:
                    line = line.strip()
                    if line.startswith("##TOTAL"):
                        VIDEO_STATUS["total"] = int(line.split()[1])
                        VIDEO_STATUS["msg"] = f"0 de {VIDEO_STATUS['total']}"
                    elif line.startswith("##DONE"):
                        VIDEO_STATUS["done"] += 1
                        VIDEO_STATUS["msg"] = f"{VIDEO_STATUS['done']} de {VIDEO_STATUS['total']}"
                proc.wait()
                if proc.returncode != 0:
                    VIDEO_STATUS["error"] = "Erro ao otimizar (ver terminal)"
                VIDEO_STATUS["msg"] = f"Concluído: {VIDEO_STATUS['done']} vídeo(s) otimizado(s)"
            except Exception as e:
                VIDEO_STATUS["error"] = str(e)
            finally:
                VIDEO_STATUS["running"] = False

        self._json(202, {"status": "running"})
        threading.Thread(target=run, daemon=True).start()

    def _run_criativo(self, numero):
        if not numero:
            self._json(400, {"error": "numero ausente"})
            return
        if CRIATIVO_STATUS["running"]:
            self._json(202, CRIATIVO_STATUS)
            return

        def run():
            CRIATIVO_STATUS.update(running=True, numero=numero, video_id=None,
                                   error=None, msg="Preparando criativo no Meta…")
            try:
                proc = subprocess.Popen(
                    ["python3", CRIATIVO_SCRIPT, "--numero", str(numero)],
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, cwd=SCRIPTS, env={**os.environ, "PYTHONWARNINGS": "ignore"})
                for line in proc.stdout:
                    line = line.strip()
                    if line.startswith("##VIDEOID"):
                        CRIATIVO_STATUS["video_id"] = line.split()[1]
                    elif line and not line.startswith("#"):
                        CRIATIVO_STATUS["msg"] = line[:80]
                proc.wait()
                if proc.returncode != 0 and not CRIATIVO_STATUS["video_id"]:
                    CRIATIVO_STATUS["error"] = CRIATIVO_STATUS.get("msg") or "Erro ao preparar criativo"
            except Exception as e:
                CRIATIVO_STATUS["error"] = str(e)
            finally:
                CRIATIVO_STATUS["running"] = False

        self._json(202, {"status": "running"})
        threading.Thread(target=run, daemon=True).start()

    def _run_adicionar(self, numero, pasta):
        if not numero:
            self._json(400, {"error": "numero ausente"}); return
        if ADD_STATUS["running"]:
            self._json(202, ADD_STATUS); return

        def run():
            ADD_STATUS.update(running=True, numero=numero, tipo=None, done=False,
                              error=None, msg="Buscando material no Drive…")
            try:
                cmd = ["python3", ADICIONAR_SCRIPT, "--numero", str(numero)]
                cmd += (["--pasta", pasta] if pasta else ["--auto"])
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                                        stderr=subprocess.STDOUT, text=True, cwd=SCRIPTS, env={**os.environ, "PYTHONWARNINGS": "ignore"})
                for line in proc.stdout:
                    line = line.strip()
                    if line.startswith("##TIPO"):
                        ADD_STATUS["tipo"] = line.split()[1]
                        ADD_STATUS["msg"] = f"Otimizando ({ADD_STATUS['tipo']})…"
                    elif line.startswith("##DONE"):
                        ADD_STATUS["done"] = True
                    elif line.startswith("##ERROR"):
                        ADD_STATUS["error"] = line.replace("##ERROR", "").strip() or "erro"
                    elif line and not line.startswith("#"):
                        ADD_STATUS["msg"] = line[:80]
                proc.wait()
                if proc.returncode != 0 and not ADD_STATUS["done"]:
                    ADD_STATUS["error"] = ADD_STATUS.get("error") or ADD_STATUS.get("msg") or "Erro ao adicionar criativo"
            except Exception as e:
                ADD_STATUS["error"] = str(e)
            finally:
                ADD_STATUS["running"] = False

        self._json(202, {"status": "running"})
        threading.Thread(target=run, daemon=True).start()

    def _run_sync(self):
        def run():
            try:
                result = subprocess.run(
                    ["python3", SYNC_SCRIPT],
                    capture_output=True, text=True, timeout=900,
                    cwd=os.path.dirname(SYNC_SCRIPT)
                )
                return {"ok": result.returncode == 0,
                        "stdout": result.stdout[-4000:],
                        "stderr": result.stderr[-2000:]}
            except subprocess.TimeoutExpired:
                return {"ok": False, "error": "timeout após 5 minutos"}
            except Exception as e:
                return {"ok": False, "error": str(e)}

        # Responde imediatamente com 202 e roda o sync em background
        self.send_response(202)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "running"}).encode())
        threading.Thread(target=run, daemon=True).start()

    def log_message(self, fmt, *args):
        # Silencia GETs frequentes de assets, mantém POSTs visíveis
        if args and str(args[0]).startswith("POST"):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    os.chdir(ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), TrackerHandler) as httpd:
        print(f"Tracker FMN em http://localhost:{PORT}  |  POST /api/sync para sync manual")
        httpd.serve_forever()
