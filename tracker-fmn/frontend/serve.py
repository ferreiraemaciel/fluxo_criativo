#!/usr/bin/env python3
"""Servidor estático local do Tracker FMN com cache desabilitado.
Expõe também POST /api/sync para rodar sync_runner.py sob demanda."""
import http.server
import socketserver
import subprocess
import json
import os
import threading

PORT = 3030
ROOT = os.path.dirname(os.path.abspath(__file__))
SYNC_SCRIPT = os.path.join(os.path.dirname(ROOT), "scripts", "sync_runner.py")

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

    def do_POST(self):
        if self.path == "/api/sync":
            self._run_sync()
        else:
            self.send_error(404)

    def _run_sync(self):
        def run():
            try:
                result = subprocess.run(
                    ["python3", SYNC_SCRIPT],
                    capture_output=True, text=True, timeout=300,
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
