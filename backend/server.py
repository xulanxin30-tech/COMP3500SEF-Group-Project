# -*- coding: utf-8 -*-
"""Logistics Management System · Backend REST API
Owner: XIE Jiayan
Note: built on the Python standard library (http.server), zero dependencies, runnable directly.
Run: python backend/server.py, then visit http://localhost:8000/api/health
"""
from contextlib import contextmanager
from datetime import datetime, timezone
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

# Temporary demo authentication; formal password hashing is still pending.
# These public demonstration credentials are not production authentication.
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo123"
MAX_BODY_BYTES = 65536
MAX_SQLITE_ID = 2**63 - 1
SHIPMENT_STATUSES = ("pending", "shipped", "delivered")


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
    """Create schema and seed data once when the shipments table is missing."""
    with database_connection(database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        if "shipments" not in tables:
            connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


SHIPMENT_SELECT = """
    SELECT shipments.shipment_id AS id, shipments.tracking_number,
           users.username AS sender, shipments.receiver_name, shipments.status
    FROM shipments LEFT JOIN users ON users.user_id = shipments.sender_id
"""


def get_shipment(connection, shipment_id):
    row = connection.execute(
        SHIPMENT_SELECT + " WHERE shipments.shipment_id = ?", (shipment_id,)
    ).fetchone()
    if row is None:
        raise APIError(404, "shipment not found")
    return dict(row)


def item_payload(row):
    payload = dict(row)
    payload["unit_price"] = float(payload["unit_price"])
    return payload


def event_payload(row):
    payload = dict(row)
    payload["id"] = payload.pop("event_id")
    return payload


def positive_integer(value, field):
    if type(value) is not int or not 1 <= value <= MAX_SQLITE_ID:
        raise APIError(400, field + " must be a positive 64-bit integer")
    return value


def optional_hub_id(value):
    if value is None:
        return None
    return positive_integer(value, "hub_id")


def required_text(value, field):
    if not isinstance(value, str) or not value.strip():
        raise APIError(400, field + " must be a non-empty string")
    return value.strip()


def parse_shipment_id(value):
    if len(value) > 19:
        raise APIError(400, "shipment id must be a positive 64-bit integer")
    return positive_integer(int(value), "shipment id")


def allocate_tracking_number(connection):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    next_id = connection.execute(
        "SELECT IFNULL(MAX(shipment_id), 0) + 1 FROM shipments"
    ).fetchone()[0]
    return f"HK{stamp}{next_id:04d}"


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
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._send({"status": "ok", "service": "lms-backend"})
        elif path in ("/api/shipments", "/api/items"):
            with database_connection(self.server.database_path) as connection:
                if path == "/api/shipments":
                    query = SHIPMENT_SELECT + " ORDER BY shipments.shipment_id"
                    rows = [dict(row) for row in connection.execute(query)]
                else:
                    query = """
                        SELECT item_id AS id, item_name, sku, stock_quantity, unit_price
                        FROM items ORDER BY item_id
                    """
                    rows = [item_payload(row) for row in connection.execute(query)]
            self._send(rows)
        else:
            self._send({"error": "not found"}, 404)

    def do_POST(self):
        self._handle(self._post)

    def _post(self):
        path = urlsplit(self.path).path
        if path == "/api/auth/login":
            self._login()
        elif path == "/api/shipments":
            self._require_auth()
            self._create_shipment()
        else:
            match = re.fullmatch(r"/api/shipments/([0-9]+)/events", path)
            if match:
                self._require_auth()
                self._append_tracking_event(parse_shipment_id(match[1]))
            else:
                raise APIError(404, "not found")

    def _create_shipment(self):
        data = self._read_json((
            "sender_id", "receiver_name", "receiver_phone",
            "delivery_address", "sku", "quantity",
        ))
        sender_id = positive_integer(data["sender_id"], "sender_id")
        quantity = positive_integer(data["quantity"], "quantity")
        receiver_name = required_text(data["receiver_name"], "receiver_name")
        receiver_phone = required_text(data["receiver_phone"], "receiver_phone")
        delivery_address = required_text(data["delivery_address"], "delivery_address")
        sku = required_text(data["sku"], "sku")
        with database_connection(self.server.database_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            if connection.execute(
                "SELECT user_id FROM users WHERE user_id = ?", (sender_id,)
            ).fetchone() is None:
                raise APIError(404, "sender not found")
            stock = connection.execute(
                "SELECT item_id, stock_quantity FROM items WHERE sku = ? ORDER BY item_id LIMIT 1",
                (sku,),
            ).fetchone()
            if stock is None:
                raise APIError(404, "item not found")
            if stock["stock_quantity"] < quantity:
                raise APIError(409, "insufficient inventory")
            updated = connection.execute(
                """UPDATE items SET stock_quantity = stock_quantity - ?
                   WHERE item_id = ? AND stock_quantity >= ?""",
                (quantity, stock["item_id"], quantity),
            )
            if updated.rowcount != 1:
                raise APIError(409, "insufficient inventory")
            tracking_number = allocate_tracking_number(connection)
            shipment_id = connection.execute(
                """INSERT INTO shipments (
                       tracking_number, sender_id, receiver_name, receiver_phone,
                       delivery_address, status
                   ) VALUES (?, ?, ?, ?, ?, 'pending')""",
                (tracking_number, sender_id, receiver_name, receiver_phone, delivery_address),
            ).lastrowid
            connection.execute(
                "INSERT INTO shipment_items (shipment_id, item_id, quantity) VALUES (?, ?, ?)",
                (shipment_id, stock["item_id"], quantity),
            )
            connection.execute(
                """INSERT INTO tracking_events (shipment_id, hub_id, status, description)
                   VALUES (?, NULL, 'pending', 'Shipping order created by sender.')""",
                (shipment_id,),
            )
            shipment = get_shipment(connection, shipment_id)
        self._send(shipment, 201)

    def _append_tracking_event(self, shipment_id):
        data = self._read_json(("hub_id", "status", "description"))
        if data["status"] not in SHIPMENT_STATUSES:
            raise APIError(400, "status must be pending, shipped, or delivered")
        description = required_text(data["description"], "description")
        hub_id = optional_hub_id(data["hub_id"])
        with database_connection(self.server.database_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            get_shipment(connection, shipment_id)
            if hub_id is not None and connection.execute(
                "SELECT hub_id FROM hubs WHERE hub_id = ?", (hub_id,)
            ).fetchone() is None:
                raise APIError(404, "hub not found")
            event_id = connection.execute(
                """INSERT INTO tracking_events (shipment_id, hub_id, status, description)
                   VALUES (?, ?, ?, ?)""",
                (shipment_id, hub_id, data["status"], description),
            ).lastrowid
            result = event_payload(connection.execute(
                """SELECT event_id, shipment_id, hub_id, status, description, event_time
                   FROM tracking_events WHERE event_id = ?""",
                (event_id,),
            ).fetchone())
        self._send(result)

    def do_PATCH(self):
        self._handle(self._patch)

    def _patch(self):
        match = re.fullmatch(r"/api/shipments/([0-9]+)/status", urlsplit(self.path).path)
        if match is None:
            raise APIError(404, "not found")
        self._require_auth()
        shipment_id = parse_shipment_id(match[1])
        data = self._read_json(("status",))
        if data["status"] not in SHIPMENT_STATUSES:
            raise APIError(400, "status must be pending, shipped, or delivered")
        with database_connection(self.server.database_path) as connection:
            updated = connection.execute(
                """UPDATE shipments SET status = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE shipment_id = ?""",
                (data["status"], shipment_id),
            )
            if updated.rowcount != 1:
                raise APIError(404, "shipment not found")
            connection.execute(
                """INSERT INTO tracking_events (shipment_id, hub_id, status, description)
                   VALUES (?, NULL, ?, ?)""",
                (shipment_id, data["status"], "Shipment status updated to " + data["status"] + "."),
            )
            shipment = get_shipment(connection, shipment_id)
        self._send(shipment)

    def log_message(self, fmt, *args):
        """Quieter logs"""
        print("[%s] %s" % (self.address_string(), fmt % args))


def create_server(port=8000, database_path=None):
    """Create the API server with a configurable listen address."""
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
