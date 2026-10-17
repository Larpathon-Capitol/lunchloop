"""Serves the built LunchLoop web app and forwards /api requests to the API.

Usage: python serve.py DIST_DIR PORT API_URL

Only the standard library is used, so it runs in the app's Python environment.
Unknown paths fall back to index.html so client-side routes work on reload.
"""
import http.client
import mimetypes
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

DIST = Path(sys.argv[1]).resolve()
PORT = int(sys.argv[2])
API = urlsplit(sys.argv[3])
HOP_BY_HOP = {"connection", "keep-alive", "transfer-encoding", "te", "upgrade", "proxy-authorization", "proxy-authenticate", "trailer"}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        if self.path.split("?")[0].startswith("/api"):
            return self.proxy()
        return self.static()

    do_HEAD = do_GET

    def do_POST(self):
        self.proxy()

    do_PUT = do_PATCH = do_DELETE = do_POST

    def static(self):
        path = unquote(urlsplit(self.path).path).lstrip("/")
        target = (DIST / path).resolve()
        if not target.is_file() or DIST not in target.parents:
            target = DIST / "index.html"
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def proxy(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP_BY_HOP | {"host"}}
        try:
            connection = http.client.HTTPConnection(API.hostname, API.port, timeout=60)
            connection.request(self.command, self.path, body=body, headers=headers)
            reply = connection.getresponse()
            data = reply.read()
        except OSError:
            data = b'{"error": "the LunchLoop API is not responding"}'
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_response(reply.status)
        for key, value in reply.getheaders():
            if key.lower() not in HOP_BY_HOP | {"content-length"}:
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass


ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
