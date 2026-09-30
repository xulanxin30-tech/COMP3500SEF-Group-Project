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

    def test_orders(self):
        status, body = self.request("/api/orders")
        self.assertEqual(status, 200)
        self.assertEqual(body, [
            {"id": 1, "customer": "Alice", "status": "Shipped"},
            {"id": 2, "customer": "Bob", "status": "Pending"},
        ])

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
            ("POST", "/api/orders", {"customer_id": 1, "product": "Widget A", "quantity": 1}),
            ("POST", "/api/orders/1/waybill", {"waybill_no": "DEMO-WB-001"}),
            ("PATCH", "/api/orders/1/status", {"status": "shipped"}),
        ]
        for method, path, data in routes:
            for token in (None, "invalid-token"):
                with self.subTest(path=path, token=token):
                    status, _ = self.request(path, method, data, token)
                    self.assertEqual(status, 401)
        self.assertEqual(self.database_rows("SELECT quantity FROM inventory"), [(100,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM transport"), [(0,)])

    def test_login_success(self):
        token = self.login()
        status, _ = self.request("/api/orders/1/status", "PATCH", {"status": "pending"}, token)
        self.assertEqual(status, 200)

    def test_login_rejects_invalid_credentials(self):
        status, body = self.request(
            "/api/auth/login", "POST", {"username": "demo", "password": "wrong"}
        )
        self.assertEqual(status, 401)
        self.assertNotIn("token", body)

    def test_create_order_deducts_inventory(self):
        token = self.login()
        self.assertEqual(self.request("/api/inventory"), (200, [
            {"id": 1, "product": "Widget A", "quantity": 100},
        ]))
        status, order = self.request(
            "/api/orders", "POST", {"customer_id": 1, "product": "Widget A", "quantity": 7}, token
        )
        self.assertEqual(status, 201)
        self.assertEqual(order, {"id": 3, "customer": "Alice", "status": "pending"})
        self.assertEqual(self.request("/api/inventory")[1][0]["quantity"], 93)
        self.assertIn(order, self.request("/api/orders")[1])
        self.assertEqual(self.database_rows("SELECT quantity FROM inventory WHERE id = 1"), [(93,)])
        self.assertEqual(self.database_rows("SELECT customer_id, status FROM orders WHERE id = 3"),
                         [(1, "pending")])

    def test_insufficient_inventory_leaves_database_unchanged(self):
        token = self.login()
        orders_before = self.request("/api/orders")
        inventory_before = self.request("/api/inventory")
        status, _ = self.request(
            "/api/orders", "POST", {"customer_id": 1, "product": "Widget A", "quantity": 101}, token
        )
        self.assertEqual(status, 409)
        self.assertEqual(self.request("/api/orders"), orders_before)
        self.assertEqual(self.request("/api/inventory"), inventory_before)

    def test_missing_product_or_customer(self):
        token = self.login()
        for customer_id, product in ((1, "Missing product"), (999, "Widget A")):
            with self.subTest(customer_id=customer_id, product=product):
                status, _ = self.request(
                    "/api/orders", "POST",
                    {"customer_id": customer_id, "product": product, "quantity": 1}, token
                )
                self.assertEqual(status, 404)
        self.assertEqual(self.database_rows("SELECT quantity FROM inventory"), [(100,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM orders"), [(2,)])

    def test_order_input_validation(self):
        token = self.login()
        valid = {"customer_id": 1, "product": "Widget A", "quantity": 1}
        invalid = [{**valid, "quantity": quantity}
                   for quantity in (0, -1, True, 1.5, "1", 2**63)]
        invalid += [{**valid, "customer_id": customer_id} for customer_id in (0, True, 2**63)]
        invalid += [{**valid, "product": " "}, {"customer_id": 1}, {**valid, "extra": 1}]
        for data in invalid:
            with self.subTest(data=data):
                self.assertEqual(self.request("/api/orders", "POST", data, token)[0], 400)
        self.assertEqual(self.database_rows("SELECT quantity FROM inventory"), [(100,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM orders"), [(2,)])

    def test_update_order_status(self):
        token = self.login()
        for value in ("pending", "shipped", "delivered"):
            with self.subTest(status=value):
                status, order = self.request("/api/orders/1/status", "PATCH", {"status": value}, token)
                self.assertEqual(status, 200)
                self.assertEqual(order, {"id": 1, "customer": "Alice", "status": value})
                self.assertEqual(self.request("/api/orders")[1][0], order)
        self.assertEqual(self.database_rows("SELECT status FROM orders WHERE id = 1"), [("delivered",)])

    def test_invalid_order_status(self):
        token = self.login()
        for value in ("dispatched", "cancelled", "Shipped", None, True, []):
            with self.subTest(status=value):
                status, _ = self.request("/api/orders/1/status", "PATCH", {"status": value}, token)
                self.assertEqual(status, 400)
        self.assertEqual(self.database_rows("SELECT status FROM orders WHERE id = 1"), [("Shipped",)])

    def test_assign_and_replace_waybill(self):
        token = self.login()
        status, transport = self.request(
            "/api/orders/1/waybill", "POST", {"waybill_no": "DEMO-WB-001"}, token
        )
        self.assertEqual(status, 200)
        self.assertEqual(transport, {
            "id": 1, "order_id": 1, "waybill_no": "DEMO-WB-001", "status": "dispatched",
        })
        status, updated = self.request(
            "/api/orders/1/waybill", "POST", {"waybill_no": "DEMO-WB-002"}, token
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated, {**transport, "waybill_no": "DEMO-WB-002"})
        self.assertEqual(self.database_rows("SELECT order_id, waybill_no, status FROM transport"),
                         [(1, "DEMO-WB-002", "dispatched")])
        self.assertEqual(self.database_rows("SELECT status FROM orders WHERE id = 1"), [("Shipped",)])

    def test_invalid_waybill(self):
        token = self.login()
        for value in ("", " ", None, 123):
            with self.subTest(waybill_no=value):
                status, _ = self.request("/api/orders/1/waybill", "POST", {"waybill_no": value}, token)
                self.assertEqual(status, 400)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM transport"), [(0,)])

    def test_writes_to_missing_orders(self):
        token = self.login()
        for method, path, data in (
            ("POST", "/api/orders/999/waybill", {"waybill_no": "DEMO-WB-001"}),
            ("PATCH", "/api/orders/999/status", {"status": "delivered"}),
        ):
            with self.subTest(path=path):
                self.assertEqual(self.request(path, method, data, token)[0], 404)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM transport"), [(0,)])

    def test_invalid_json(self):
        token = self.login()
        for raw_body in (b'{', b'[]', b'null', b'\xff'):
            with self.subTest(raw_body=raw_body):
                status, _ = self.request("/api/orders", "POST", token=token, raw_body=raw_body)
                self.assertEqual(status, 400)
        self.assertEqual(self.request("/api/health")[0], 200)

    def test_data_persists_and_seed_is_not_repeated(self):
        token = self.login()
        status, order = self.request(
            "/api/orders", "POST", {"customer_id": 1, "product": "Widget A", "quantity": 5}, token
        )
        self.assertEqual(status, 201)
        path = f'/api/orders/{order["id"]}'
        self.assertEqual(self.request(path + "/status", "PATCH", {"status": "delivered"}, token)[0], 200)
        self.assertEqual(self.request(path + "/waybill", "POST", {"waybill_no": "PERSISTED"}, token)[0], 200)
        self.stop_server()
        self.start_server()
        self.assertEqual(self.request("/api/inventory")[1], [
            {"id": 1, "product": "Widget A", "quantity": 95},
        ])
        self.assertEqual(self.request("/api/orders")[1][-1], {**order, "status": "delivered"})
        self.assertEqual(self.database_rows("SELECT name FROM customers ORDER BY id"), [("Alice",), ("Bob",)])
        self.assertEqual(self.database_rows("SELECT waybill_no FROM transport"), [("PERSISTED",)])
        self.assertEqual(self.request(path + "/status", "PATCH", {"status": "pending"}, token)[0], 401)

    def test_cors_preflight_and_public_health(self):
        request = Request(self.base_url + "/api/orders", method="OPTIONS", headers={
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
