#!/usr/bin/env python3
"""Read-only post-deploy smoke test for CPMS (Lab 5 Episodes 5 & 7)."""

import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Optional, Tuple


def _request_once(
    url: str,
    method: str = "GET",
    headers: Optional[dict] = None,
    json_body: Optional[dict] = None,
    timeout: int = 15,
) -> Tuple[int, str, str]:
    data = None
    req_headers = dict(headers or {})
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status = resp.getcode()
            content_type = resp.headers.get("Content-Type", "")
            body = resp.read().decode("utf-8", errors="replace")
            return status, content_type, body
    except urllib.error.HTTPError as err:
        content_type = err.headers.get("Content-Type", "") if err.headers else ""
        body = err.read().decode("utf-8", errors="replace")
        code = err.code
        err.close()
        return code, content_type, body


def _request(
    url: str,
    method: str = "GET",
    headers: Optional[dict] = None,
    json_body: Optional[dict] = None,
    timeout: int = 15,
    retries: int = 0,
    delay: float = 2.0,
) -> Tuple[int, str, str]:
    last_err: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            return _request_once(url, method=method, headers=headers, json_body=json_body, timeout=timeout)
        except (urllib.error.URLError, http.client.HTTPException, ConnectionError, OSError) as exc:
            last_err = exc
            if attempt < retries:
                time.sleep(delay)
    assert last_err is not None
    raise last_err


def run_smoke_tests(
    base_url: str,
    email: Optional[str] = None,
    password: Optional[str] = None,
) -> int:
    base = base_url.rstrip("/")

    try:
        # 1. GET /api/health -> 200 (retry briefly for cold-start containers / Cloud Run revisions)
        status, _, body = _request(f"{base}/api/health", retries=5, delay=2.0)
        if status != 200:
            print(f"FAIL /api/health: expected 200, got {status}", file=sys.stderr)
            return 1
        data = json.loads(body)
        if data.get("status") != "ok":
            print(f"FAIL /api/health: unexpected body {data}", file=sys.stderr)
            return 1
        print("PASS /api/health")

        # 2. GET /api/ready -> 200 (db connected)
        status, _, body = _request(f"{base}/api/ready")
        if status != 200:
            print(f"FAIL /api/ready: expected 200, got {status}", file=sys.stderr)
            return 1
        data = json.loads(body)
        if data.get("status") != "ready" or data.get("db") != "connected":
            print(f"FAIL /api/ready: unexpected body {data}", file=sys.stderr)
            return 1
        print("PASS /api/ready")

        # 3. GET / -> 200 HTML
        status, ctype, body = _request(f"{base}/")
        if status != 200 or "text/html" not in ctype.lower() or "<html" not in body.lower():
            print(f"FAIL /: expected 200 text/html, got {status} ({ctype})", file=sys.stderr)
            return 1
        print("PASS /")

        # 4. Unauthenticated GET /api/teams -> 401
        status, _, _ = _request(f"{base}/api/teams")
        if status != 401:
            print(f"FAIL /api/teams: expected 401 without token, got {status}", file=sys.stderr)
            return 1
        print("PASS /api/teams (401 unauthenticated)")

        # 5. Optional read-only login check (only if both SMOKE_EMAIL and SMOKE_PASSWORD are set)
        if email and password:
            status, _, body = _request(
                f"{base}/api/auth/login",
                method="POST",
                json_body={"email": email, "password": password},
            )
            if status != 200:
                print(f"FAIL login: expected 200, got {status}", file=sys.stderr)
                return 1
            token = json.loads(body).get("token")
            if not token:
                print("FAIL login: missing token in response", file=sys.stderr)
                return 1

            status, _, _ = _request(
                f"{base}/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )
            if status != 200:
                print(f"FAIL /api/auth/me: expected 200, got {status}", file=sys.stderr)
                return 1
            print("PASS login and authenticated /api/auth/me")

            status, _, _ = _request(
                f"{base}/api/auth/logout",
                method="POST",
                headers={"Authorization": f"Bearer {token}"},
            )
            if status not in (200, 204):
                print(f"FAIL logout: expected 200/204, got {status}", file=sys.stderr)
                return 1
            print("PASS logout")
        else:
            print("SKIP login: optional smoke credentials not configured")

        return 0
    except Exception as exc:
        print(f"FAIL smoke test error: {exc}", file=sys.stderr)
        return 1


def main() -> int:
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("Usage: smoke_test.py <SERVICE_URL>", file=sys.stderr)
        return 1
    email = os.environ.get("SMOKE_EMAIL", "").strip() or None
    password = os.environ.get("SMOKE_PASSWORD", "").strip() or None
    return run_smoke_tests(sys.argv[1], email=email, password=password)


if __name__ == "__main__":
    sys.exit(main())
