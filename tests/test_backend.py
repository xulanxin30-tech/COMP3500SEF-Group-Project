"""HTTP API and server listen-address regression tests."""
import ipaddress
import json
import os
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import ProxyHandler, build_opener

from backend.server import create_server


class TestListenAddress(unittest.TestCase):
    def test_default_address_is_loopback(self):
        with patch.dict(os.environ):
            os.environ.pop("LMS_HOST", None)
            with create_server(port=0) as server:
                self.assertTrue(ipaddress.ip_address(server.server_address[0]).is_loopback)

    def test_address_can_accept_forwarded_container_requests(self):
        with patch.dict(os.environ, {"LMS_HOST": "0.0.0.0"}):
            with create_server(port=0) as server:
                self.assertEqual(server.socket.getsockname()[0], "0.0.0.0")


class TestBackendAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.dict(os.environ, {"LMS_HOST": "127.0.0.1"}):
            cls.server = create_server(port=0)
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

    def request(self, path):
        try:
            response = self.client.open(self.base_url + path, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            self.assertEqual(response.headers.get_content_type(), "application/json")
            return response.status, json.load(response)

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
