# -*- coding: utf-8 -*-
"""Logistics Management System · Backend REST API
Owner: XIE Jiayan
Note: built on the Python standard library (http.server), zero dependencies, runnable directly.
Run: python backend/server.py, then visit http://localhost:8000/api/health
"""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import re
import secrets
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit

DEFAULT_DATABASE = Path(__file__).resolve().with_name("lms.db")
SCHEMA_PATH = Path(__file__).resolve().parent.parent / "database" / "schema.sql"

# Temporary demo authentication; formal users table is 待 CEN 确认.
# These public demonstration credentials are not production authentication.
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo123"
MAX_BODY_BYTES = 65536
MAX_SQLITE_ID = 2**63 - 1
ORDER_STATUSES = ("pending", "shipped", "delivered")


class APIError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


@contextmanager
def database_connection(database_path):
    """Use a separate connection per request, with transactions and FK checks."""
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize_database(database_path):
    """Load the unchanged schema once; retain the legacy demo order responses."""
    is_new = not database_path.exists()
    with database_connection(database_path) as connection:
        if is_new:
            connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        if connection.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 0:
            # Temporary compatibility samples for an empty orders table.
            # Preserve legacy capitalization; new orders use lowercase statuses.
            for name, status in (("Alice", "Shipped"), ("Bob", "Pending")):
                customer = connection.execute(
                    "SELECT id FROM customers WHERE name = ? ORDER BY id LIMIT 1",
                    (name,),
                ).fetchone()
                if customer is None:
                    customer_id = connection.execute(
                        "INSERT INTO customers (name) VALUES (?)", (name,)
                    ).lastrowid
                else:
                    customer_id = customer["id"]
                connection.execute(
                    "INSERT INTO orders (customer_id, status) VALUES (?, ?)",
                    (customer_id, status),
                )


ORDER_SELECT = """
    SELECT orders.id, customers.name AS customer, orders.status
    FROM orders LEFT JOIN customers ON customers.id = orders.customer_id
"""


def get_order(connection, order_id):
    row = connection.execute(ORDER_SELECT + " WHERE orders.id = ?", (order_id,)).fetchone()
    if row is None:
        raise APIError(404, "order not found")
    return dict(row)


def positive_integer(value, field):
    if type(value) is not int or not 1 <= value <= MAX_SQLITE_ID:
        raise APIError(400, field + " must be a positive 64-bit integer")
    return value


def required_text(value, field):
    if not isinstance(value, str) or not value.strip():
        raise APIError(400, field + " must be a non-empty string")
    return value.strip()


def parse_order_id(value):
    if len(value) > 19:
        raise APIError(400, "order id must be a positive 64-bit integer")
    return positive_integer(int(value), "order id")


class Handler(BaseHTTPRequestHandler):
    """HTTP request handler"""

    def _send(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors_headers()
        if code == 401:
            self.send_header("WWW-Authenticate", "Bearer")
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _read_json(self, fields):
        if self.headers.get_content_type() != "application/json":
            raise APIError(415, "Content-Type must be application/json")
        if self.headers.get("Transfer-Encoding"):
            raise APIError(400, "Transfer-Encoding is not supported")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise APIError(400, "invalid Content-Length")
        if length <= 0:
            raise APIError(400, "JSON body is required")
        if length > MAX_BODY_BYTES:
            raise APIError(413, "JSON body is too large")
        try:
            data = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            raise APIError(400, "invalid JSON")
        if not isinstance(data, dict) or set(data) != set(fields):
            raise APIError(400, "expected fields: " + ", ".join(fields))
        return data

    def _require_auth(self):
        scheme, _, token = self.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "bearer" or token not in self.server.tokens:
            raise APIError(401, "valid bearer token is required")

    def _login(self):
        data = self._read_json(("username", "password"))
        if any(not isinstance(data[field], str) or not data[field]
               for field in ("username", "password")):
            raise APIError(400, "username and password must be non-empty strings")
        if data["username"] != DEMO_USERNAME or data["password"] != DEMO_PASSWORD:
            raise APIError(401, "invalid credentials")
        token = secrets.token_urlsafe(32)
        self.server.tokens.add(token)
        self._send({"token": token, "token_type": "Bearer"})

    def _handle(self, action):
        try:
            action()
        except APIError as error:
            self._send({"error": str(error)}, error.code)
        except sqlite3.Error:
            self._send({"error": "database operation failed"}, 500)

    def do_GET(self):
        self._handle(self._get)

    def _get(self):
        """GET routes"""
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._send({"status": "ok", "service": "lms-backend"})
        elif path in ("/api/orders", "/api/inventory"):
            with database_connection(self.server.database_path) as connection:
                query = (ORDER_SELECT + " ORDER BY orders.id" if path == "/api/orders"
                         else "SELECT id, product, quantity FROM inventory ORDER BY id")
                rows = [dict(row) for row in connection.execute(query)]
            self._send(rows)
        else:
            self._send({"error": "not found"}, 404)

    def do_POST(self):
        self._handle(self._post)

    def _post(self):
        path = urlsplit(self.path).path
        if path == "/api/auth/login":
            self._login()
        elif path == "/api/orders":
            self._require_auth()
            self._create_order()
        else:
            match = re.fullmatch(r"/api/orders/([0-9]+)/waybill", path)
            if match:
                self._require_auth()
                self._assign_waybill(parse_order_id(match[1]))
            else:
                raise APIError(404, "not found")

    def _create_order(self):
        data = self._read_json(("customer_id", "product", "quantity"))
        customer_id = positive_integer(data["customer_id"], "customer_id")
        quantity = positive_integer(data["quantity"], "quantity")
        product = required_text(data["product"], "product")
        with database_connection(self.server.database_path) as connection:
            # Lock before reading stock so concurrent writers cannot oversell.
            connection.execute("BEGIN IMMEDIATE")
            if connection.execute(
                "SELECT id FROM customers WHERE id = ?", (customer_id,)
            ).fetchone() is None:
                raise APIError(404, "customer not found")
            # Temporary product text matching; choose the lowest matching id.
            # Order line items and formal inventory/order FK are 待 CEN 确认.
            # Product/quantity cannot be persisted on orders with today's schema.
            stock = connection.execute(
                "SELECT id, quantity FROM inventory WHERE product = ? ORDER BY id LIMIT 1",
                (product,),
            ).fetchone()
            if stock is None:
                raise APIError(404, "product not found")
            if stock["quantity"] < quantity:
                raise APIError(409, "insufficient inventory")
            updated = connection.execute(
                "UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?",
                (quantity, stock["id"], quantity),
            )
            if updated.rowcount != 1:
                raise APIError(409, "insufficient inventory")
            order_id = connection.execute(
                "INSERT INTO orders (customer_id, status) VALUES (?, 'pending')",
                (customer_id,),
            ).lastrowid
            order = get_order(connection, order_id)
        self._send(order, 201)

    def _assign_waybill(self, order_id):
        data = self._read_json(("waybill_no",))
        waybill_no = required_text(data["waybill_no"], "waybill_no")
        with database_connection(self.server.database_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            get_order(connection, order_id)
            # Temporary caller-supplied waybill; generation/uniqueness rules
            # and transport's formal one-per-order constraint are 待 CEN 确认.
            transport = connection.execute(
                "SELECT id FROM transport WHERE order_id = ? ORDER BY id LIMIT 1",
                (order_id,),
            ).fetchone()
            if transport is None:
                transport_id = connection.execute(
                    "INSERT INTO transport (order_id, waybill_no) VALUES (?, ?)",
                    (order_id, waybill_no),
                ).lastrowid
            else:
                transport_id = transport["id"]
                connection.execute(
                    "UPDATE transport SET waybill_no = ? WHERE id = ?",
                    (waybill_no, transport_id),
                )
            result = dict(connection.execute(
                "SELECT id, order_id, waybill_no, status FROM transport WHERE id = ?",
                (transport_id,),
            ).fetchone())
        self._send(result)

    def do_PATCH(self):
        self._handle(self._patch)

    def _patch(self):
        match = re.fullmatch(r"/api/orders/([0-9]+)/status", urlsplit(self.path).path)
        if match is None:
            raise APIError(404, "not found")
        self._require_auth()
        order_id = parse_order_id(match[1])
        data = self._read_json(("status",))
        if data["status"] not in ORDER_STATUSES:
            raise APIError(400, "status must be pending, shipped, or delivered")
        with database_connection(self.server.database_path) as connection:
            updated = connection.execute(
                "UPDATE orders SET status = ? WHERE id = ?", (data["status"], order_id)
            )
            if updated.rowcount != 1:
                raise APIError(404, "order not found")
            order = get_order(connection, order_id)
        self._send(order)

    def log_message(self, fmt, *args):
        """Quieter logs"""
        print("[%s] %s" % (self.address_string(), fmt % args))


def create_server(port=8000, database_path=None):
    """Create the API server with a configurable listen address."""
    # Tests can supply an isolated file; LMS_DB_PATH also supports local smoke checks.
    path = Path(database_path if database_path is not None
                else os.environ.get("LMS_DB_PATH", DEFAULT_DATABASE))
    initialize_database(path)
    server = HTTPServer((os.environ.get("LMS_HOST", "localhost"), port), Handler)
    server.tokens = set()
    server.database_path = path
    return server


if __name__ == "__main__":
    PORT = 8000
    with create_server(PORT) as server:
        print(f"LMS backend running at http://{server.server_address[0]}:{PORT}")
        print("Try: http://localhost:8000/api/health")
        server.serve_forever()
