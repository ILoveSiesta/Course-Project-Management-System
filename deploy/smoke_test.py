#!/usr/bin/env python3
"""Read-only post-deploy smoke test for CPMS (Lab 5 Episodes 5 & 7)."""

import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Callable, Optional, Tuple


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


def _check_with_retry(
    label: str,
    check_fn: Callable[[], Optional[str]],
    attempts: int = 5,
    retry_delay: float = 3.0,
) -> None:
    """Runs check_fn up to `attempts` times; check_fn returns None on pass or an error string."""
    last_reason = "unknown failure"
    for attempt in range(attempts):
        try:
            err = check_fn()
            if err is None:
                return
            last_reason = err
        except (urllib.error.URLError, http.client.HTTPException, ConnectionError, OSError, json.JSONDecodeError) as exc:
            last_reason = str(exc)

        if attempt < attempts - 1 and retry_delay > 0:
            time.sleep(retry_delay)

    raise RuntimeError(f"FAIL {label}: {last_reason}")


def run_smoke_tests(
    base_url: str,
    email: Optional[str] = None,
    password: Optional[str] = None,
    attempts: int = 5,
    retry_delay: float = 3.0,
) -> int:
    base = base_url.rstrip("/")

    # Fail loudly if only one credential is provided
    if bool(email) != bool(password):
        print("FAIL: Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.", file=sys.stderr)
        return 1

    try:
        # 1. GET /api/health -> 200
        def check_health() -> Optional[str]:
            status, _, body = _request_once(f"{base}/api/health")
            if status != 200:
                return f"expected 200, got {status}"
            data = json.loads(body)
            if data.get("status") != "ok":
                return f"unexpected body {data}"
            return None

        _check_with_retry("/api/health", check_health, attempts=attempts, retry_delay=retry_delay)
        print("PASS /api/health")

        # 2. GET /api/ready -> 200 (db connected)
        def check_ready() -> Optional[str]:
            status, _, body = _request_once(f"{base}/api/ready")
            if status != 200:
                return f"expected 200, got {status}"
            data = json.loads(body)
            if data.get("status") != "ready" or data.get("db") != "connected":
                return f"unexpected body {data}"
            return None

        _check_with_retry("/api/ready", check_ready, attempts=attempts, retry_delay=retry_delay)
        print("PASS /api/ready")

        # 3. GET / -> 200 HTML
        def check_root() -> Optional[str]:
            status, ctype, body = _request_once(f"{base}/")
            if status != 200 or "text/html" not in ctype.lower() or "<html" not in body.lower():
                return f"expected 200 text/html, got {status} ({ctype})"
            return None

        _check_with_retry("/", check_root, attempts=attempts, retry_delay=retry_delay)
        print("PASS /")

        # 4. Unauthenticated GET /api/teams -> 401
        def check_unauth() -> Optional[str]:
            status, _, _ = _request_once(f"{base}/api/teams")
            if status != 401:
                return f"expected 401 without token, got {status}"
            return None

        _check_with_retry("/api/teams", check_unauth, attempts=attempts, retry_delay=retry_delay)
        print("PASS /api/teams (401 unauthenticated)")

        # 5. Optional read-only login check (only if both SMOKE_EMAIL and SMOKE_PASSWORD are set)
        if email and password:
            status, _, body = _request_once(
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

            try:
                status, _, _ = _request_once(
                    f"{base}/api/auth/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if status != 200:
                    print(f"FAIL /api/auth/me: expected 200, got {status}", file=sys.stderr)
                    return 1
                print("PASS login and authenticated /api/auth/me")
            finally:
                try:
                    logout_status, _, _ = _request_once(
                        f"{base}/api/auth/logout",
                        method="POST",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if logout_status in (200, 204):
                        print("PASS logout")
                    else:
                        print(f"WARN logout returned {logout_status}", file=sys.stderr)
                except Exception as logout_exc:
                    print(f"WARN logout error: {logout_exc}", file=sys.stderr)
        else:
            print("SKIP login: optional smoke credentials not configured")

        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
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
