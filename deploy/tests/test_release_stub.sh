#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
RELEASE_SCRIPT="$ROOT_DIR/deploy/release.sh"

if [ ! -f "$RELEASE_SCRIPT" ]; then
  echo "FAIL: $RELEASE_SCRIPT does not exist"
  exit 1
fi

SHA="0123456789abcdef0123456789abcdef01234567"
OUTPUT="$(DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 IMAGE_TAG="$SHA" bash "$RELEASE_SCRIPT")"

assert_contains() {
  local needle="$1"
  if ! printf '%s' "$OUTPUT" | grep -Fq -- "$needle"; then
    echo "FAIL: expected release dry-run output to contain: $needle"
    exit 1
  fi
}

assert_contains "cpe334-cpms"
assert_contains "asia-southeast1"
assert_contains "asia-southeast1-docker.pkg.dev/cpe334-cpms/cpms/cpms:$SHA"
assert_contains "cpms-migrate"
assert_contains "npx prisma migrate deploy && npm run prisma:seed"
assert_contains "DATABASE_URL=cpms-database-url:latest,SEED_DEMO_PASSWORD=cpms-demo-password:latest"
assert_contains "DATABASE_URL=cpms-database-url:latest,JWT_SECRET=cpms-jwt-secret:latest"
assert_contains "CLIENT_DIST_DIR=/app/client/dist"
assert_contains "cpms-runner@cpe334-cpms.iam.gserviceaccount.com"
assert_contains "cpms-pg"

if printf '%s' "$OUTPUT" | grep -qi "toktickit"; then
  echo "FAIL: release dry-run output still references toktickit"
  exit 1
fi

if DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 IMAGE_TAG="" bash "$RELEASE_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: release.sh should exit non-zero when IMAGE_TAG is missing"
  exit 1
fi

echo "PASS: test_release_stub"
