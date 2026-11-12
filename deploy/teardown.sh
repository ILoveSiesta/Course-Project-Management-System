#!/usr/bin/env bash
set -euo pipefail

# End-of-term teardown script for CPMS GCP resources (Lab 5 Episode 10).
# Do NOT run before grading is complete. Supports DRY_RUN=1 preview mode.

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-southeast1}"
DRY_RUN="${DRY_RUN:-0}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is required." >&2
  exit 1
fi

REPO_NAME="cpms"
SQL_INSTANCE="cpms-pg"
SERVICE_NAME="cpms"
MIGRATE_JOB_NAME="cpms-migrate"
SA_NAME="cpms-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

SECRET_DB_URL="cpms-database-url"
SECRET_JWT_SECRET="cpms-jwt-secret"
SECRET_DEMO_PASS="cpms-demo-password"

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] $*"
  else
    "$@" || true
  fi
}

echo "========================================"
echo "CPMS GCP Resource Teardown"
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo "Dry Run : $DRY_RUN"
echo "========================================"

if [ "$DRY_RUN" != "1" ]; then
  read -r -p "Type the exact Project ID (${PROJECT_ID}) to confirm deletion: " confirm
  if [ "$confirm" != "$PROJECT_ID" ]; then
    echo "Aborted: confirmation did not match."
    exit 1
  fi
fi

run_cmd gcloud run services delete "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --quiet
run_cmd gcloud run jobs delete "$MIGRATE_JOB_NAME" --region="$REGION" --project="$PROJECT_ID" --quiet
run_cmd gcloud sql instances delete "$SQL_INSTANCE" --project="$PROJECT_ID" --quiet
run_cmd gcloud artifacts repositories delete "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID" --quiet
run_cmd gcloud secrets delete "$SECRET_DB_URL" --project="$PROJECT_ID" --quiet
run_cmd gcloud secrets delete "$SECRET_JWT_SECRET" --project="$PROJECT_ID" --quiet
run_cmd gcloud secrets delete "$SECRET_DEMO_PASS" --project="$PROJECT_ID" --quiet
run_cmd gcloud iam service-accounts delete "$SA_EMAIL" --project="$PROJECT_ID" --quiet

echo "Teardown completed."
