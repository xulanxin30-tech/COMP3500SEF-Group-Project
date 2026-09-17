# -*- coding: utf-8 -*-
"""Logistics Management System · Backend REST API template
Owner: XIE Jiayan
Note: built on the Python standard library (http.server), zero dependencies, runnable directly.
Run: python backend/server.py, then visit http://localhost:8000/api/health
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

# Sample data (to be wired to the database schema in database/schema.sql)
ORDERS = [
    {"id": 1, "customer": "Alice", "status": "Shipped"},
    {"id": 2, "customer": "Bob",   "status": "Pending"},
]


class Handler(BaseHTTPRequestHandler):
    """HTTP request handler"""

    def _send(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        """GET routes"""
        if self.path == "/api/health":
            self._send({"status": "ok", "service": "lms-backend"})
        elif self.path == "/api/orders":
            self._send(ORDERS)
        else:
            self._send({"error": "not found"}, 404)

    def log_message(self, fmt, *args):
        """Quieter logs"""
        print("[%s] %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    PORT = 8000
    print(f"LMS backend running at http://localhost:{PORT}")
    print("Try: http://localhost:8000/api/health")
    HTTPServer(("localhost", PORT), Handler).serve_forever()
