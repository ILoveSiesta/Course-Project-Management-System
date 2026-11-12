#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_SCRIPT="$ROOT_DIR/deploy/deploy.sh"

if [ ! -f "$DEPLOY_SCRIPT" ]; then
  echo "FAIL: $DEPLOY_SCRIPT does not exist"
  exit 1
fi

OUTPUT="$(DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 bash "$DEPLOY_SCRIPT")"

assert_contains() {
  local needle="$1"
  if ! printf '%s' "$OUTPUT" | grep -Fq -- "$needle"; then
    echo "FAIL: expected deploy dry-run output to contain: $needle"
    exit 1
  fi
}

assert_contains "cpe334-cpms"
assert_contains "asia-southeast1"
assert_contains "cpms-pg"
assert_contains "cpms-migrate"
assert_contains "cpms-runner"
assert_contains "cpms-database-url"
assert_contains "cpms-jwt-secret"
assert_contains "cpms-demo-password"
assert_contains "POSTGRES_16"
assert_contains "--edition=enterprise"
assert_contains "npx prisma migrate deploy && npm run prisma:seed"
assert_contains "DATABASE_URL=cpms-database-url:latest"
assert_contains "SEED_DEMO_PASSWORD=cpms-demo-password:latest"
assert_contains "JWT_SECRET=cpms-jwt-secret:latest"
assert_contains "CLIENT_DIST_DIR=/app/client/dist"
assert_contains "--min-instances=0"
assert_contains "--max-instances=3"
assert_contains "--port=3000"

if printf '%s' "$OUTPUT" | grep -qi "toktickit"; then
  echo "FAIL: deploy dry-run output still references toktickit"
  exit 1
fi

if PROJECT_ID="" bash "$DEPLOY_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: deploy.sh should exit non-zero when PROJECT_ID is missing"
  exit 1
fi

# Re-run idempotency test: fake gcloud reporting every resource and secret already exists
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
GCLOUD_LOG="$TMP_DIR/gcloud.log"

cat > "$TMP_DIR/gcloud" << 'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$GCLOUD_LOG"
case "$*" in
  *"sql users list"*)
    echo "cpms"
    ;;
  *"run services describe"*)
    echo "https://cpms-mock.a.run.app"
    ;;
esac
exit 0
EOF
chmod +x "$TMP_DIR/gcloud"

GCLOUD_LOG="$GCLOUD_LOG" PATH="$TMP_DIR:$PATH" \
  PROJECT_ID=cpe334-cpms REGION=asia-southeast1 \
  bash "$DEPLOY_SCRIPT" >/dev/null

if grep -qE "sql users (create|set-password)" "$GCLOUD_LOG"; then
  echo "FAIL: re-running deploy.sh must not recreate or reset DB user password when secret exists"
  cat "$GCLOUD_LOG"
  exit 1
fi

if grep -qE "secrets (create|versions add)" "$GCLOUD_LOG"; then
  echo "FAIL: re-running deploy.sh must not recreate or overwrite existing secret versions"
  cat "$GCLOUD_LOG"
  exit 1
fi

if ! grep -q "secrets add-iam-policy-binding cpms-database-url" "$GCLOUD_LOG"; then
  echo "FAIL: re-running deploy.sh should still verify secret IAM bindings"
  cat "$GCLOUD_LOG"
  exit 1
fi

echo "PASS: test_deploy_stub"
