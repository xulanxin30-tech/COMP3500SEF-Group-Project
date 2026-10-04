"""HTTP API and server listen-address regression tests."""
import ipaddress
import json
import os
import sqlite3
import threading
import unittest
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

from backend.server import create_server

SEEDED_SHIPMENT = {
    "id": 1,
    "tracking_number": "HK202610001",
    "sender": "customer_alice",
    "receiver_name": "David Cheung",
    "status": "shipped",
}
SEEDED_MOUSE = {
    "id": 1,
    "item_name": "Wireless Optical Mouse",
    "sku": "TECH-WM-001",
    "stock_quantity": 120,
    "unit_price": 150.0,
}
CREATE_SHIPMENT = {
    "sender_id": 2,
    "receiver_name": "Mary Wong",
    "receiver_phone": "+852-91112222",
    "delivery_address": "Flat A, 8/F, Harbour View, Wan Chai",
    "sku": "TECH-WM-001",
    "quantity": 7,
}


class APIClient:
    def request(self, path, method="GET", data=None, token=None, raw_body=None):
        headers = {}
        body = raw_body
        if data is not None:
            body = json.dumps(data).encode("utf-8")
        if body is not None:
            headers["Content-Type"] = "application/json"
        if token is not None:
            headers["Authorization"] = "Bearer " + token
        request = Request(self.base_url + path, data=body, headers=headers, method=method)
        try:
            response = self.client.open(request, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            self.assertEqual(response.headers.get_content_type(), "application/json")
            if response.status == 401:
                self.assertEqual(response.headers["WWW-Authenticate"], "Bearer")
            return response.status, json.load(response)


class TestListenAddress(unittest.TestCase):
    def test_default_address_is_loopback(self):
        with TemporaryDirectory() as directory, patch.dict(os.environ):
            os.environ.pop("LMS_HOST", None)
            with create_server(port=0, database_path=Path(directory) / "lms.db") as server:
                self.assertTrue(ipaddress.ip_address(server.server_address[0]).is_loopback)

    def test_address_can_accept_forwarded_container_requests(self):
        with TemporaryDirectory() as directory, patch.dict(os.environ, {"LMS_HOST": "0.0.0.0"}):
            with create_server(port=0, database_path=Path(directory) / "lms.db") as server:
                self.assertEqual(server.socket.getsockname()[0], "0.0.0.0")


class TestBackendAPI(APIClient, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = TemporaryDirectory()
        with patch.dict(os.environ, {"LMS_HOST": "127.0.0.1"}):
            cls.server = create_server(port=0, database_path=Path(cls.directory.name) / "lms.db")
        cls.worker = threading.Thread(
            target=cls.server.serve_forever,
            kwargs={"poll_interval": 0.01},
            daemon=True,
        )
        cls.worker.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.client = build_opener(ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.worker.join(timeout=5)
        cls.server.server_close()
        cls.directory.cleanup()

    def test_health(self):
        status, body = self.request("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(body, {"status": "ok", "service": "lms-backend"})

    def test_shipments(self):
        status, body = self.request("/api/shipments")
        self.assertEqual(status, 200)
        self.assertEqual(body, [SEEDED_SHIPMENT])

    def test_unknown_path(self):
        status, body = self.request("/missing")
        self.assertEqual(status, 404)
        self.assertEqual(body, {"error": "not found"})


class TestBackendWrites(APIClient, unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.database_path = Path(self.directory.name) / "lms.db"
        self.client = build_opener(ProxyHandler({}))
        self.start_server()
        self.addCleanup(self.stop_server)

    def start_server(self):
        with patch.dict(os.environ, {"LMS_HOST": "127.0.0.1"}):
            self.server = create_server(port=0, database_path=self.database_path)
        self.worker = threading.Thread(
            target=self.server.serve_forever,
            kwargs={"poll_interval": 0.01},
            daemon=True,
        )
        self.worker.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def stop_server(self):
        self.server.shutdown()
        self.worker.join(timeout=5)
        self.server.server_close()

    def login(self):
        status, body = self.request(
            "/api/auth/login", "POST", {"username": "demo", "password": "demo123"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["token_type"], "Bearer")
        self.assertIsInstance(body["token"], str)
        self.assertTrue(body["token"])
        return body["token"]

    def database_rows(self, query):
        with closing(sqlite3.connect(self.database_path)) as connection:
            return connection.execute(query).fetchall()

    def test_write_routes_require_login(self):
        routes = [
            ("POST", "/api/shipments", CREATE_SHIPMENT),
            ("POST", "/api/shipments/1/events", {
                "hub_id": 1, "status": "shipped", "description": "Arrived at hub.",
            }),
            ("PATCH", "/api/shipments/1/status", {"status": "shipped"}),
        ]
        for method, path, data in routes:
            for token in (None, "invalid-token"):
                with self.subTest(path=path, token=token):
                    status, _ = self.request(path, method, data, token)
                    self.assertEqual(status, 401)
        self.assertEqual(self.database_rows("SELECT stock_quantity FROM items WHERE item_id = 1"),
                         [(120,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_login_success(self):
        token = self.login()
        status, _ = self.request("/api/shipments/1/status", "PATCH", {"status": "pending"}, token)
        self.assertEqual(status, 200)

    def test_login_rejects_invalid_credentials(self):
        status, body = self.request(
            "/api/auth/login", "POST", {"username": "demo", "password": "wrong"}
        )
        self.assertEqual(status, 401)
        self.assertNotIn("token", body)

    def test_create_shipment_deducts_inventory(self):
        token = self.login()
        status, items = self.request("/api/items")
        self.assertEqual(status, 200)
        self.assertEqual(items[0], SEEDED_MOUSE)
        status, shipment = self.request("/api/shipments", "POST", CREATE_SHIPMENT, token)
        self.assertEqual(status, 201)
        self.assertEqual(shipment["id"], 2)
        self.assertEqual(shipment["sender"], "customer_alice")
        self.assertEqual(shipment["receiver_name"], "Mary Wong")
        self.assertEqual(shipment["status"], "pending")
        self.assertTrue(shipment["tracking_number"].startswith("HK"))
        self.assertEqual(self.request("/api/items")[1][0]["stock_quantity"], 113)
        self.assertIn(shipment, self.request("/api/shipments")[1])
        self.assertEqual(self.database_rows("SELECT stock_quantity FROM items WHERE item_id = 1"),
                         [(113,)])
        self.assertEqual(self.database_rows(
            "SELECT sender_id, status FROM shipments WHERE shipment_id = 2"
        ), [(2, "pending")])
        self.assertEqual(self.database_rows(
            "SELECT item_id, quantity FROM shipment_items WHERE shipment_id = 2"
        ), [(1, 7)])

    def test_insufficient_inventory_leaves_database_unchanged(self):
        token = self.login()
        shipments_before = self.request("/api/shipments")
        items_before = self.request("/api/items")
        status, _ = self.request(
            "/api/shipments", "POST", {**CREATE_SHIPMENT, "quantity": 121}, token
        )
        self.assertEqual(status, 409)
        self.assertEqual(self.request("/api/shipments"), shipments_before)
        self.assertEqual(self.request("/api/items"), items_before)

    def test_missing_item_or_sender(self):
        token = self.login()
        cases = (
            {**CREATE_SHIPMENT, "sku": "MISSING-SKU"},
            {**CREATE_SHIPMENT, "sender_id": 999},
        )
        for data in cases:
            with self.subTest(data=data):
                status, _ = self.request("/api/shipments", "POST", data, token)
                self.assertEqual(status, 404)
        self.assertEqual(self.database_rows("SELECT stock_quantity FROM items WHERE item_id = 1"),
                         [(120,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM shipments"), [(1,)])

    def test_shipment_input_validation(self):
        token = self.login()
        valid = CREATE_SHIPMENT
        invalid = [{**valid, "quantity": quantity} for quantity in (0, -1, True, 1.5, "1", 2**63)]
        invalid += [{**valid, "sender_id": sender_id} for sender_id in (0, True, 2**63)]
        invalid += [{**valid, "sku": " "}, {"sender_id": 2}, {**valid, "extra": 1}]
        for data in invalid:
            with self.subTest(data=data):
                self.assertEqual(self.request("/api/shipments", "POST", data, token)[0], 400)
        self.assertEqual(self.database_rows("SELECT stock_quantity FROM items WHERE item_id = 1"),
                         [(120,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM shipments"), [(1,)])

    def test_update_shipment_status(self):
        token = self.login()
        expected = dict(SEEDED_SHIPMENT)
        for value in ("pending", "shipped", "delivered"):
            with self.subTest(status=value):
                expected["status"] = value
                status, shipment = self.request(
                    "/api/shipments/1/status", "PATCH", {"status": value}, token
                )
                self.assertEqual(status, 200)
                self.assertEqual(shipment, expected)
                self.assertEqual(self.request("/api/shipments")[1][0], shipment)
        self.assertEqual(self.database_rows("SELECT status FROM shipments WHERE shipment_id = 1"),
                         [("delivered",)])

    def test_invalid_shipment_status(self):
        token = self.login()
        for value in ("dispatched", "cancelled", "Shipped", None, True, []):
            with self.subTest(status=value):
                status, _ = self.request(
                    "/api/shipments/1/status", "PATCH", {"status": value}, token
                )
                self.assertEqual(status, 400)
        self.assertEqual(self.database_rows("SELECT status FROM shipments WHERE shipment_id = 1"),
                         [("shipped",)])

    def test_append_tracking_events(self):
        token = self.login()
        status, event = self.request(
            "/api/shipments/1/events", "POST",
            {"hub_id": 1, "status": "shipped", "description": "Arrived at Kowloon Sorting Center."},
            token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(event["id"], 3)
        self.assertEqual(event["shipment_id"], 1)
        self.assertEqual(event["hub_id"], 1)
        self.assertEqual(event["status"], "shipped")
        self.assertEqual(event["description"], "Arrived at Kowloon Sorting Center.")
        self.assertIn("event_time", event)
        status, second = self.request(
            "/api/shipments/1/events", "POST",
            {"hub_id": None, "status": "delivered", "description": "Delivered to receiver."},
            token,
        )
        self.assertEqual(status, 200)
        self.assertEqual(second["id"], 4)
        self.assertIsNone(second["hub_id"])
        self.assertEqual(self.database_rows(
            "SELECT status, description FROM tracking_events ORDER BY event_id"
        ), [
            ("pending", "Shipping order created by sender."),
            ("shipped", "Parcel picked up and arrived at Kowloon Sorting Center."),
            ("shipped", "Arrived at Kowloon Sorting Center."),
            ("delivered", "Delivered to receiver."),
        ])
        self.assertEqual(self.database_rows("SELECT status FROM shipments WHERE shipment_id = 1"),
                         [("shipped",)])

    def test_invalid_tracking_event(self):
        token = self.login()
        valid = {"hub_id": 1, "status": "shipped", "description": "Arrived at hub."}
        for data in (
            {**valid, "description": " "},
            {**valid, "status": "dispatched"},
            {**valid, "hub_id": 0},
            {"description": "Arrived at hub."},
        ):
            with self.subTest(data=data):
                status, _ = self.request("/api/shipments/1/events", "POST", data, token)
                self.assertEqual(status, 400)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_writes_to_missing_shipments(self):
        token = self.login()
        for method, path, data in (
            ("POST", "/api/shipments/999/events", {
                "hub_id": 1, "status": "shipped", "description": "Arrived at hub.",
            }),
            ("PATCH", "/api/shipments/999/status", {"status": "delivered"}),
        ):
            with self.subTest(path=path):
                self.assertEqual(self.request(path, method, data, token)[0], 404)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_invalid_json(self):
        token = self.login()
        for raw_body in (b'{', b'[]', b'null', b'\xff'):
            with self.subTest(raw_body=raw_body):
                status, _ = self.request("/api/shipments", "POST", token=token, raw_body=raw_body)
                self.assertEqual(status, 400)
        self.assertEqual(self.request("/api/health")[0], 200)

    def test_data_persists_and_seed_is_not_repeated(self):
        token = self.login()
        status, shipment = self.request("/api/shipments", "POST", CREATE_SHIPMENT, token)
        self.assertEqual(status, 201)
        path = f'/api/shipments/{shipment["id"]}'
        self.assertEqual(self.request(path + "/status", "PATCH", {"status": "delivered"}, token)[0], 200)
        self.assertEqual(self.request(path + "/events", "POST", {
            "hub_id": 2, "status": "delivered", "description": "Out for delivery from Central.",
        }, token)[0], 200)
        self.stop_server()
        self.start_server()
        self.assertEqual(self.request("/api/items")[1][0]["stock_quantity"], 113)
        self.assertEqual(self.request("/api/shipments")[1][-1], {**shipment, "status": "delivered"})
        self.assertEqual(
            self.database_rows("SELECT username FROM users ORDER BY user_id"),
            [("admin_alan",), ("customer_alice",), ("courier_chan",)],
        )
        self.assertEqual(
            self.database_rows("SELECT description FROM tracking_events WHERE shipment_id = 2 ORDER BY event_id"),
            [
                ("Shipping order created by sender.",),
                ("Shipment status updated to delivered.",),
                ("Out for delivery from Central.",),
            ],
        )
        self.assertEqual(self.request(path + "/status", "PATCH", {"status": "pending"}, token)[0], 401)

    def test_cors_preflight_and_public_health(self):
        request = Request(self.base_url + "/api/shipments", method="OPTIONS", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        })
        with self.client.open(request, timeout=5) as response:
            self.assertEqual(response.status, 204)
            self.assertEqual(response.read(), b"")
            self.assertEqual(response.headers["Access-Control-Allow-Origin"], "*")
            self.assertIn("POST", response.headers["Access-Control-Allow-Methods"])
            self.assertIn("Authorization", response.headers["Access-Control-Allow-Headers"])
        with self.client.open(self.base_url + "/api/health", timeout=5) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers["Access-Control-Allow-Origin"], "*")
