#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
RELEASE_SCRIPT="$ROOT_DIR/deploy/release.sh"

if [ ! -f "$RELEASE_SCRIPT" ]; then
  echo "FAIL: $RELEASE_SCRIPT does not exist"
  exit 1
fi

SHA="0123456789abcdef0123456789abcdef01234567"
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT

OUTPUT="$(GITHUB_ENV="$ENV_FILE" DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 IMAGE_TAG="$SHA" bash "$RELEASE_SCRIPT")"

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if ! printf '%s' "$haystack" | grep -Fq -- "$needle"; then
    echo "FAIL: expected output to contain: $needle"
    exit 1
  fi
}

assert_contains "$OUTPUT" "cpe334-cpms"
assert_contains "$OUTPUT" "asia-southeast1"
assert_contains "$OUTPUT" "asia-southeast1-docker.pkg.dev/cpe334-cpms/cpms/cpms:$SHA"
assert_contains "$OUTPUT" "gcloud run jobs update cpms-migrate"
assert_contains "$OUTPUT" "gcloud run jobs execute cpms-migrate"
assert_contains "$OUTPUT" "gcloud run services update cpms"
assert_contains "$OUTPUT" "gcloud run services update-traffic cpms --to-latest"

if printf '%s' "$OUTPUT" | grep -qi "toktickit"; then
  echo "FAIL: release dry-run output still references toktickit"
  exit 1
fi

if printf '%s' "$OUTPUT" | grep -Fq "run deploy"; then
  echo "FAIL: release.sh should use services update / jobs update instead of gcloud run deploy"
  exit 1
fi

if ! grep -Fq "SERVICE_URL=" "$ENV_FILE" || ! grep -Fq "DEPLOYED_IMAGE=" "$ENV_FILE"; then
  echo "FAIL: release.sh must write SERVICE_URL and DEPLOYED_IMAGE to GITHUB_ENV"
  exit 1
fi

# Rollback mode: skips migration job update and execution
ROLLBACK_OUTPUT="$(DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 IMAGE_TAG="$SHA" ROLLBACK=true bash "$RELEASE_SCRIPT")"
if printf '%s' "$ROLLBACK_OUTPUT" | grep -qE "jobs (update|execute)"; then
  echo "FAIL: ROLLBACK=true must skip migration job update and execution"
  exit 1
fi
assert_contains "$ROLLBACK_OUTPUT" "gcloud run services update cpms"
assert_contains "$ROLLBACK_OUTPUT" "gcloud run services update-traffic cpms --to-latest"

# Invalid inputs must fail
if DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 IMAGE_TAG="" bash "$RELEASE_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: release.sh should exit non-zero when IMAGE_TAG is missing"
  exit 1
fi

if DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 IMAGE_TAG="abc;rm" bash "$RELEASE_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: release.sh should exit non-zero for invalid IMAGE_TAG"
  exit 1
fi

if DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 IMAGE_TAG="0123456" bash "$RELEASE_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: release.sh should exit non-zero for short SHA"
  exit 1
fi

if DRY_RUN=1 PROJECT_ID=cpe334-cpms REGION=asia-southeast1 IMAGE_TAG="$SHA" ROLLBACK="maybe" bash "$RELEASE_SCRIPT" >/dev/null 2>&1; then
  echo "FAIL: release.sh should exit non-zero for invalid ROLLBACK value"
  exit 1
fi

echo "PASS: test_release_stub"
