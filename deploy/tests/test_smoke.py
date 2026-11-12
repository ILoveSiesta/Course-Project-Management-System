import json
import os
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DEPLOY_DIR = Path(__file__).resolve().parents[1]
if str(DEPLOY_DIR) not in sys.path:
    sys.path.insert(0, str(DEPLOY_DIR))

import smoke_test  # noqa: E402


class MockConfig:
    def __init__(self):
        self.ready_status = 200
        self.teams_unauth_status = 401
        self.login_status = 200
        self.seen_paths = []


def make_handler(config: MockConfig):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def _send_json(self, code: int, payload: dict):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            config.seen_paths.append(("GET", self.path))
            if self.path == "/api/health":
                self._send_json(200, {"status": "ok", "service": "CPMS API"})
            elif self.path == "/api/ready":
                if config.ready_status == 200:
                    self._send_json(200, {"status": "ready", "db": "connected"})
                else:
                    self._send_json(config.ready_status, {"status": "not_ready", "db": "unreachable"})
            elif self.path == "/":
                body = b"<!doctype html><html><body><div id='root'></div></body></html>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path == "/api/teams":
                if self.headers.get("Authorization") == "Bearer smoke-token":
                    self._send_json(200, {"teams": []})
                else:
                    self._send_json(config.teams_unauth_status, {"error": {"code": "UNAUTHENTICATED"}})
            elif self.path == "/api/auth/me":
                if self.headers.get("Authorization") == "Bearer smoke-token":
                    self._send_json(200, {"user": {"id": 1, "email": "smoke@cpms.test", "role": "STUDENT"}})
                else:
                    self._send_json(401, {"error": {"code": "UNAUTHENTICATED"}})
            else:
                self._send_json(404, {"error": {"code": "NOT_FOUND"}})

        def do_POST(self):
            config.seen_paths.append(("POST", self.path))
            length = int(self.headers.get("Content-Length", "0"))
            if length > 0:
                self.rfile.read(length)
            if self.path == "/api/auth/login":
                if config.login_status == 200:
                    self._send_json(200, {"token": "smoke-token", "user": {"email": "smoke@cpms.test"}})
                else:
                    self._send_json(config.login_status, {"error": {"code": "INVALID_CREDENTIALS"}})
            elif self.path == "/api/auth/logout":
                self._send_json(200, {"ok": True})
            else:
                self._send_json(404, {"error": {"code": "NOT_FOUND"}})

    return Handler


class SmokeTestSuite(unittest.TestCase):
    def setUp(self):
        self.cfg = MockConfig()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.cfg))
        self.port = self.server.server_address[1]
        self.base_url = f"http://127.0.0.1:{self.port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def test_passes_without_login_credentials(self):
        code = smoke_test.run_smoke_tests(self.base_url)
        self.assertEqual(code, 0)
        self.assertIn(("GET", "/api/health"), self.cfg.seen_paths)
        self.assertIn(("GET", "/api/ready"), self.cfg.seen_paths)
        self.assertIn(("GET", "/"), self.cfg.seen_paths)
        self.assertIn(("GET", "/api/teams"), self.cfg.seen_paths)
        self.assertNotIn(("POST", "/api/auth/login"), self.cfg.seen_paths)

    def test_passes_with_login_credentials(self):
        code = smoke_test.run_smoke_tests(self.base_url, email="smoke@cpms.test", password="secret")
        self.assertEqual(code, 0)
        self.assertIn(("POST", "/api/auth/login"), self.cfg.seen_paths)
        self.assertIn(("GET", "/api/auth/me"), self.cfg.seen_paths)
        self.assertIn(("POST", "/api/auth/logout"), self.cfg.seen_paths)

    def test_fails_when_ready_returns_503(self):
        self.cfg.ready_status = 503
        code = smoke_test.run_smoke_tests(self.base_url)
        self.assertNotEqual(code, 0)

    def test_fails_when_unauthenticated_teams_does_not_return_401(self):
        self.cfg.teams_unauth_status = 200
        code = smoke_test.run_smoke_tests(self.base_url)
        self.assertNotEqual(code, 0)

    def test_fails_when_login_is_rejected(self):
        self.cfg.login_status = 401
        code = smoke_test.run_smoke_tests(self.base_url, email="smoke@cpms.test", password="wrong")
        self.assertNotEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
