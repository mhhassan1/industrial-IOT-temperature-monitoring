"""Dependency-free local HTTP dashboard and JSON APIs."""
from __future__ import annotations
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from .storage import TelemetryStore
from .simulator import Simulator

WEB = Path(__file__).resolve().parent / "web"
LOG = logging.getLogger(__name__)


def handler_factory(store: TelemetryStore, simulator: Simulator | None, *, demo: bool):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            LOG.info("%s %s", self.client_address[0], format % args)

        def respond(self, status: int, data: bytes, content_type="application/json; charset=utf-8", **headers):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            for key, val in headers.items(): self.send_header(key.replace("_", "-"), val)
            self.end_headers()
            self.wfile.write(data)

        def json_response(self, obj, status=200):
            self.respond(status, json.dumps(obj, separators=(",", ":"), allow_nan=False).encode())

        def do_GET(self):
            parsed = urlsplit(self.path)
            route, params = parsed.path, parse_qs(parsed.query)
            if route in ("/", "/assets/app.css", "/assets/app.js"):
                name = "index.html" if route == "/" else route.rsplit("/", 1)[1]
                types = {"index.html":"text/html; charset=utf-8", "app.css":"text/css; charset=utf-8",
                         "app.js":"application/javascript; charset=utf-8"}
                return self.respond(200, (WEB/name).read_bytes(), types[name])
            if route == "/api/snapshot":
                store.check_stale()
                return self.json_response({**store.snapshot(), "demo_controls_enabled":demo})
            if route == "/api/history":
                device = (params.get("device") or [""])[0]
                if not device or len(device)>64:
                    return self.json_response({"error":"Missing or invalid device"},400)
                try: limit = int((params.get("limit") or ["70"])[0])
                except ValueError: return self.json_response({"error":"Invalid limit"},400)
                return self.json_response({"device":device, "points":store.history(device,limit)})
            if route == "/api/alerts":
                return self.json_response({"alerts":store.alerts()})
            if route == "/api/export.csv":
                return self.respond(200, store.csv_bytes(), "text/csv; charset=utf-8",
                                    Content_Disposition='attachment; filename="edgewatch-demo-readings.csv"')
            if route == "/healthz":
                return self.json_response({"status":"ok", "mode":"demo" if demo else "mqtt"})
            return self.json_response({"error":"Not found"},404)

        def do_POST(self):
            # Demo controls intentionally disabled for live MQTT mode.
            if not demo or simulator is None:
                return self.json_response({"error":"Simulation controls unavailable"},403)
            if self.headers.get("Content-Length", "0") not in ("0", ""):
                return self.json_response({"error":"This endpoint does not accept a body"},400)
            parsed = urlsplit(self.path)
            params = parse_qs(parsed.query)
            device = (params.get("device") or ["NODE-A"])[0]
            try:
                if parsed.path == "/api/demo/heat":
                    simulator.heat(device)
                elif parsed.path == "/api/demo/offline":
                    simulator.disconnect(device)
                else:
                    return self.json_response({"error":"Not found"},404)
            except ValueError as ex:
                return self.json_response({"error":str(ex)},400)
            return self.json_response({"ok":True, "scenario":parsed.path.split("/")[-1], "device":device})
    return Handler


def serve(store, simulator, host, port, *, demo):
    server = ThreadingHTTPServer((host,port), handler_factory(store, simulator, demo=demo))
    LOG.info("Dashboard listening on http://%s:%s", host,port)
    try: server.serve_forever(poll_interval=.5)
    finally: server.server_close()
