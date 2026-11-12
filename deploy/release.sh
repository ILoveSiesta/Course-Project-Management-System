#!/usr/bin/env bash
set -euo pipefail

# Release / rollback deployment script for CPMS (Lab 5 Episode 7 & 8).
# Resolves an Artifact Registry image by commit SHA tag to its immutable digest,
# runs the Cloud Run migration job, and updates the Cloud Run service.
# Supports DRY_RUN=1 for offline testing.

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-southeast1}"
IMAGE_TAG="${IMAGE_TAG:-}"
DRY_RUN="${DRY_RUN:-0}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is required." >&2
  exit 1
fi

if [ -z "$IMAGE_TAG" ]; then
  echo "Error: IMAGE_TAG (full commit SHA) is required." >&2
  exit 1
fi

REPO_NAME="cpms"
SQL_INSTANCE="cpms-pg"
SERVICE_NAME="cpms"
MIGRATE_JOB_NAME="cpms-migrate"
SA_NAME="cpms-runner"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_CONN_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
IMAGE_REF="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

SECRET_DB_URL="cpms-database-url"
SECRET_JWT_SECRET="cpms-jwt-secret"
SECRET_DEMO_PASS="cpms-demo-password"

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] $*"
  else
    "$@"
  fi
}

echo "========================================"
echo "CPMS Release Deployment"
echo "Project   : $PROJECT_ID"
echo "Region    : $REGION"
echo "Image Tag : $IMAGE_TAG"
echo "Dry Run   : $DRY_RUN"
echo "========================================"

if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud artifacts docker images describe "$IMAGE_REF" --project="$PROJECT_ID" --format="value(image_summary.digest)"
  DIGEST="sha256:dryrun000000000000000000000000000000000000000000000000000000000000"
else
  DIGEST="$(gcloud artifacts docker images describe "$IMAGE_REF" --project="$PROJECT_ID" --format='value(image_summary.digest)')"
  if [ -z "$DIGEST" ]; then
    echo "Error: could not resolve digest for $IMAGE_REF" >&2
    exit 1
  fi
fi

IMAGE_BY_DIGEST="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}@${DIGEST}"
echo "Resolved image digest: $IMAGE_BY_DIGEST"

JOB_SECRETS="DATABASE_URL=${SECRET_DB_URL}:latest,SEED_DEMO_PASSWORD=${SECRET_DEMO_PASS}:latest"

run_cmd gcloud run jobs deploy "$MIGRATE_JOB_NAME" \
  --image="$IMAGE_BY_DIGEST" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --set-cloudsql-instances="$SQL_CONN_NAME" \
  --set-secrets="$JOB_SECRETS" \
  --set-env-vars="NODE_ENV=production,TZ=Asia/Bangkok" \
  --command="sh" \
  --args="-c,npx prisma migrate deploy && npm run prisma:seed" \
  --max-retries=1 \
  --task-timeout=300s \
  --project="$PROJECT_ID"

run_cmd gcloud run jobs execute "$MIGRATE_JOB_NAME" \
  --region="$REGION" \
  --wait \
  --project="$PROJECT_ID"

SERVICE_SECRETS="DATABASE_URL=${SECRET_DB_URL}:latest,JWT_SECRET=${SECRET_JWT_SECRET}:latest"

run_cmd gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_BY_DIGEST" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="$SA_EMAIL" \
  --add-cloudsql-instances="$SQL_CONN_NAME" \
  --set-secrets="$SERVICE_SECRETS" \
  --set-env-vars="NODE_ENV=production,TZ=Asia/Bangkok,CLIENT_DIST_DIR=/app/client/dist" \
  --min-instances=0 \
  --max-instances=3 \
  --memory=512Mi \
  --cpu=1 \
  --port=3000 \
  --project="$PROJECT_ID"

if [ "$DRY_RUN" = "1" ]; then
  SERVICE_URL="https://${SERVICE_NAME}-dryrun.a.run.app"
else
  SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "image_digest=${IMAGE_BY_DIGEST}" >> "$GITHUB_OUTPUT"
  echo "service_url=${SERVICE_URL}" >> "$GITHUB_OUTPUT"
fi

echo "Release deployed: ${SERVICE_URL} (${IMAGE_BY_DIGEST})"
