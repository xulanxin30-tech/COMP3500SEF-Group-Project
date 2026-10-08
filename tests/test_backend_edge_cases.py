"""Edge-case and boundary tests for the backend HTTP API.

Covers paths not exercised by tests/test_backend.py:
request-body handling (415/413/empty body/chunked TE), field validation
boundaries and trimming, URL path parsing, inventory boundary conditions,
tracking-event abnormal inputs, and auth-vs-validation ordering.

The sqlite3.Error -> 500 branch is defensive code that cannot be triggered
through legitimate HTTP traffic, so it is intentionally not tested here.
Note: the Python backend has no cancel/restore-stock endpoint (that logic
lives only in the frontend Node demo API), so stock-restore combinations
cannot be tested against this backend.
"""
import http.client
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

from backend.server import MAX_BODY_BYTES, create_server

CREATE_SHIPMENT = {
    "sender_id": 2,
    "receiver_name": "Mary Wong",
    "receiver_phone": "+852-91112222",
    "delivery_address": "Flat A, 8/F, Harbour View, Wan Chai",
    "sku": "TECH-WM-001",
    "quantity": 7,
}
LOGIN_BODY = {"username": "demo", "password": "demo123"}


class EdgeCaseBase(unittest.TestCase):
    """Fresh server + temporary database per test, matching test_backend.py."""

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

    def request(self, path, method="GET", data=None, token=None, raw_body=None,
                content_type=None):
        """High-level JSON request (always sends a JSON content type)."""
        # Note: urllib forces Connection: close (do_open overwrites it), so for
        # requests the server answers without reading the body (401/404 paths)
        # the close can race the response on Windows — use raw_request there.
        headers = {}
        body = raw_body
        if data is not None:
            body = json.dumps(data).encode("utf-8")
        if body is not None:
            headers["Content-Type"] = content_type or "application/json"
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

    def raw_request(self, method, path, body=None, headers=None):
        """Low-level request for header-level edge cases (urllib normalizes
        Content-Type/Content-Length/Transfer-Encoding, so http.client is used).

        All raw_request call sites are answered before the server reads the
        body (401/404/413/415/400-Transfer-Encoding). The HTTP/1.0 server
        always closes after responding, and a close with an unread request
        body can reset the socket before the client reads the response on
        Windows, so the request is retried once on a fresh connection."""
        for attempt in (1, 2):
            connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port,
                                                    timeout=5)
            try:
                connection.request(method, path, body=body, headers=headers or {})
                response = connection.getresponse()
                payload = response.read()
                return response.status, json.loads(payload.decode("utf-8"))
            except (ConnectionAbortedError, ConnectionResetError):
                if attempt == 2:
                    raise
            finally:
                connection.close()

    def login(self):
        status, body = self.request("/api/auth/login", "POST", LOGIN_BODY)
        self.assertEqual(status, 200)
        return body["token"]

    def database_rows(self, query, parameters=()):
        with closing(sqlite3.connect(self.database_path)) as connection:
            return connection.execute(query, parameters).fetchall()

    def inventory_is_unchanged(self):
        self.assertEqual(self.database_rows("SELECT stock_quantity FROM items ORDER BY item_id"),
                         [(120,), (45,), (300,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM shipments"), [(1,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])


class TestBodyValidation(EdgeCaseBase):
    def test_wrong_content_type_is_rejected(self):
        # No body is sent: the server rejects on the Content-Type header
        # alone, and a socket closed with unread body data can reset the
        # connection on Windows before the response is read.
        for path in ("/api/auth/login",):
            with self.subTest(path=path):
                status, body = self.raw_request(
                    "POST", path, headers={"Content-Type": "text/plain"},
                )
                self.assertEqual(status, 415)
                self.assertIn("Content-Type", body["error"])

    def test_missing_body_is_rejected(self):
        status, body = self.raw_request(
            "POST", "/api/auth/login",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(status, 400)
        self.assertIn("body", body["error"])

    def test_oversized_body_is_rejected(self):
        token = self.login()
        # Declare a Content-Length over the limit without sending a body:
        # the server rejects on the header alone (413) and never reads.
        status, body = self.raw_request(
            "POST", "/api/shipments",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + token,
                     "Content-Length": str(MAX_BODY_BYTES + 1)},
        )
        self.assertEqual(status, 413)
        self.assertIn("too large", body["error"])
        self.inventory_is_unchanged()

    def test_body_at_size_limit_is_accepted(self):
        token = self.login()
        padding = MAX_BODY_BYTES - len(json.dumps(CREATE_SHIPMENT).encode("utf-8")) - 4
        padded = {**CREATE_SHIPMENT, "delivery_address": "y" * padding}
        self.assertGreater(padding, 0)
        body_bytes = json.dumps(padded).encode("utf-8")
        self.assertLessEqual(len(body_bytes), MAX_BODY_BYTES)
        status, shipment = self.raw_request(
            "POST", "/api/shipments", body=body_bytes,
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + token},
        )
        self.assertEqual(status, 201)
        self.assertEqual(shipment["id"], 2)

    def test_invalid_content_length_is_rejected(self):
        status, _ = self.raw_request(
            "POST", "/api/auth/login",
            headers={"Content-Type": "application/json", "content-length": "abc"},
        )
        self.assertEqual(status, 400)

    def test_chunked_transfer_encoding_is_rejected(self):
        token = self.login()
        status, body = self.raw_request(
            "POST", "/api/shipments",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + token,
                     "Content-Length": "0",
                     "Transfer-Encoding": "chunked"},
        )
        self.assertEqual(status, 400)
        self.assertIn("Transfer-Encoding", body["error"])
        self.inventory_is_unchanged()


class TestFieldValidation(EdgeCaseBase):
    def test_receiver_fields_must_be_non_empty_strings(self):
        token = self.login()
        for field in ("receiver_name", "receiver_phone", "delivery_address"):
            for value in (" ", 123, None):
                with self.subTest(field=field, value=value):
                    status, _ = self.request(
                        "/api/shipments", "POST", {**CREATE_SHIPMENT, field: value}, token
                    )
                    self.assertEqual(status, 400)
        self.inventory_is_unchanged()

    def test_receiver_fields_are_trimmed(self):
        token = self.login()
        data = {**CREATE_SHIPMENT,
                "receiver_name": "  Mary Wong  ",
                "receiver_phone": " +852-91112222 ",
                "delivery_address": "  Flat A, Wan Chai  "}
        status, shipment = self.request("/api/shipments", "POST", data, token)
        self.assertEqual(status, 201)
        self.assertEqual(shipment["receiver_name"], "Mary Wong")
        self.assertEqual(self.database_rows(
            "SELECT receiver_name, receiver_phone, delivery_address FROM shipments"
        ), [("David Cheung", "+852-98765432",
             "Flat B, 12/F, Nathan Tower, Mong Kok, Kowloon"),
            ("Mary Wong", "+852-91112222", "Flat A, Wan Chai")])

    def test_sender_id_rejects_negative_and_non_integer(self):
        token = self.login()
        for sender_id in (-1, 1.5, "2"):
            with self.subTest(sender_id=sender_id):
                status, _ = self.request(
                    "/api/shipments", "POST", {**CREATE_SHIPMENT, "sender_id": sender_id}, token
                )
                self.assertEqual(status, 400)
        self.inventory_is_unchanged()

    def test_max_valid_quantity_fails_as_insufficient_not_invalid(self):
        token = self.login()
        status, body = self.request(
            "/api/shipments", "POST",
            {**CREATE_SHIPMENT, "quantity": 2**63 - 1}, token,
        )
        self.assertEqual(status, 409)
        self.assertIn("insufficient", body["error"])
        self.inventory_is_unchanged()

    def test_field_validation_precedes_database_lookup(self):
        token = self.login()
        # Bad sender_id (would be 404) + bad quantity (400): 400 must win.
        status, _ = self.request(
            "/api/shipments", "POST",
            {**CREATE_SHIPMENT, "sender_id": 999, "quantity": 0}, token,
        )
        self.assertEqual(status, 400)

    def test_login_field_validation(self):
        cases = (
            ({"username": "demo"}, 400),                     # missing password
            ({"username": 123, "password": "demo123"}, 400),  # non-string username
            ({"username": "demo", "password": ""}, 400),      # empty password
            ({"username": "demo", "password": "demo123", "x": 1}, 400),  # extra field
        )
        for data, expected in cases:
            with self.subTest(data=data):
                status, _ = self.request("/api/auth/login", "POST", data)
                self.assertEqual(status, expected)

    def test_login_wrong_username_is_unauthorized(self):
        status, body = self.request(
            "/api/auth/login", "POST", {"username": "nobody", "password": "demo123"}
        )
        self.assertEqual(status, 401)
        self.assertNotIn("token", body)

    def test_login_response_has_exact_keys(self):
        _, body = self.request("/api/auth/login", "POST", LOGIN_BODY)
        self.assertEqual(set(body), {"token", "token_type"})


class TestPathParsing(EdgeCaseBase):
    def test_non_numeric_shipment_id_does_not_match_event_route(self):
        token = self.login()
        status, body = self.raw_request(
            "POST", "/api/shipments/abc/events",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + token},
        )
        self.assertEqual(status, 404)
        self.assertEqual(body, {"error": "not found"})
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_overlong_shipment_id_is_a_validation_error(self):
        token = self.login()
        status, _ = self.raw_request(
            "POST", "/api/shipments/99999999999999999999/events",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + token},
        )
        self.assertEqual(status, 400)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_trailing_slash_does_not_match_status_route(self):
        token = self.login()
        status, _ = self.raw_request(
            "PATCH", "/api/shipments/1/status/",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + token},
        )
        self.assertEqual(status, 404)

    def test_single_shipment_path_is_not_found(self):
        status, _ = self.request("/api/shipments/1")
        self.assertEqual(status, 404)

    def test_routing_precedes_auth_on_unknown_paths(self):
        # Unknown write paths return 404 even without a token: routing happens
        # before _require_auth, unlike the known write routes. Requests carry
        # no body (see raw_request docstring for why).
        status, _ = self.raw_request(
            "PATCH", "/api/shipments/1/status/",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(status, 404)
        status, _ = self.raw_request(
            "POST", "/api/nothing",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(status, 404)


class TestInventoryBoundaries(EdgeCaseBase):
    def create(self, token, **overrides):
        return self.request("/api/shipments", "POST", {**CREATE_SHIPMENT, **overrides}, token)

    def test_order_exactly_matching_stock_zeroes_it(self):
        token = self.login()
        status, shipment = self.create(token, sku="TECH-KB-002", quantity=45)
        self.assertEqual(status, 201)
        self.assertEqual(self.database_rows(
            "SELECT stock_quantity FROM items WHERE item_id = 2"), [(0,)])
        self.assertEqual(self.database_rows(
            "SELECT item_id, quantity FROM shipment_items WHERE shipment_id = ?",
            (shipment["id"],)), [(2, 45)])

    def test_order_after_stock_is_zeroed_is_rejected(self):
        token = self.login()
        self.assertEqual(self.create(token, sku="TECH-KB-002", quantity=45)[0], 201)
        status, _ = self.create(token, sku="TECH-KB-002", quantity=1)
        self.assertEqual(status, 409)
        self.assertEqual(self.database_rows(
            "SELECT stock_quantity FROM items WHERE item_id = 2"), [(0,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM shipments"), [(2,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM shipment_items"), [(3,)])

    def test_back_to_back_orders_drain_stock_then_reject(self):
        token = self.login()
        self.assertEqual(self.create(token, quantity=7)[0], 201)            # 120 -> 113
        self.assertEqual(self.create(token, quantity=113)[0], 201)          # 113 -> 0
        self.assertEqual(self.database_rows(
            "SELECT stock_quantity FROM items WHERE item_id = 1"), [(0,)])
        status, _ = self.create(token, quantity=1)
        self.assertEqual(status, 409)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM shipments"), [(3,)])

    def test_failed_order_leaves_shipment_and_event_tables_unchanged(self):
        token = self.login()
        status, _ = self.create(token, quantity=120 + 1)
        self.assertEqual(status, 409)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM shipments"), [(1,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM shipment_items"), [(2,)])
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])


class TestTrackingEventEdges(EdgeCaseBase):
    EVENT = {"hub_id": 1, "status": "shipped", "description": "Arrived at hub."}

    def append(self, token, shipment_id=1, **overrides):
        return self.request(
            f"/api/shipments/{shipment_id}/events", "POST",
            {**self.EVENT, **overrides}, token,
        )

    def test_unknown_hub_is_not_found(self):
        token = self.login()
        status, _ = self.append(token, hub_id=999)
        self.assertEqual(status, 404)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_hub_id_type_boundaries(self):
        token = self.login()
        for hub_id in (True, "1", 1.5, -1, 2**63):
            with self.subTest(hub_id=hub_id):
                status, _ = self.append(token, hub_id=hub_id)
                self.assertEqual(status, 400)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_status_value_boundaries(self):
        token = self.login()
        for value in (None, True, [], "Shipped", "delivered "):
            with self.subTest(status=value):
                status, _ = self.append(token, status=value)
                self.assertEqual(status, 400)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_description_must_be_a_string(self):
        token = self.login()
        status, _ = self.append(token, description=123)
        self.assertEqual(status, 400)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_description_is_trimmed(self):
        token = self.login()
        status, event = self.append(token, description="  Arrived at hub.  ")
        self.assertEqual(status, 200)
        self.assertEqual(event["description"], "Arrived at hub.")
        self.assertEqual(self.database_rows(
            "SELECT description FROM tracking_events WHERE event_id = ?", (event["id"],)
        ), [("Arrived at hub.",)])


class TestAuthContract(EdgeCaseBase):
    def test_read_endpoints_are_public(self):
        for path in ("/api/health", "/api/shipments", "/api/items"):
            with self.subTest(path=path):
                status, _ = self.request(path)
                self.assertEqual(status, 200)

    def test_auth_precedes_body_validation_on_write_routes(self):
        # Known write route + no token + missing/invalid body: the server must
        # answer 401 before looking at the body at all.
        status, _ = self.raw_request(
            "PATCH", "/api/shipments/1/status",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(status, 401)
        status, _ = self.raw_request(
            "POST", "/api/shipments",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(status, 401)
        self.assertEqual(self.database_rows("SELECT COUNT(*) FROM tracking_events"), [(2,)])

    def test_events_route_with_wrong_method_is_unauthorized_first(self):
        # POST events route matched, no token: auth runs before body parsing.
        status, _ = self.raw_request(
            "POST", "/api/shipments/1/events",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
