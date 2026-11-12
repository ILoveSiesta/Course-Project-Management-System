#!/usr/bin/env bash
set -euo pipefail

# Release / rollback deployment script for CPMS (Lab 5 Episodes 7 & 8).
# Resolves an Artifact Registry image by full 40-char commit SHA to its immutable digest,
# runs the Cloud Run migration job (skipped when ROLLBACK=true), and updates the Cloud Run
# service + traffic. Supports DRY_RUN=1 for offline testing.

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-southeast1}"
IMAGE_TAG="${IMAGE_TAG:-}"
ROLLBACK="${ROLLBACK:-false}"
DRY_RUN="${DRY_RUN:-0}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is required." >&2
  exit 1
fi

if ! [[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Error: IMAGE_TAG must be a full 40-character lowercase commit SHA (got: '$IMAGE_TAG')." >&2
  exit 1
fi

if [ "$ROLLBACK" != "true" ] && [ "$ROLLBACK" != "false" ]; then
  echo "Error: ROLLBACK must be 'true' or 'false' (got: '$ROLLBACK')." >&2
  exit 1
fi

REPO_NAME="cpms"
SERVICE_NAME="cpms"
MIGRATE_JOB_NAME="cpms-migrate"
IMAGE_REF="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] $*"
  else
    echo "+ $*"
    "$@"
  fi
}

echo "========================================"
echo "CPMS Release Deployment"
echo "Project   : $PROJECT_ID"
echo "Region    : $REGION"
echo "Image Tag : $IMAGE_TAG"
echo "Rollback  : $ROLLBACK"
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

if [ "$ROLLBACK" = "true" ]; then
  echo "Rollback mode (ROLLBACK=true): skipping migration job update and execution."
else
  run_cmd gcloud run jobs update "$MIGRATE_JOB_NAME" \
    --image="$IMAGE_BY_DIGEST" \
    --region="$REGION" \
    --project="$PROJECT_ID"

  if ! run_cmd gcloud run jobs execute "$MIGRATE_JOB_NAME" \
    --region="$REGION" \
    --wait \
    --project="$PROJECT_ID"; then
    echo "Migration job failed. Read the job logs with:" >&2
    echo "  gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=${MIGRATE_JOB_NAME}' --project=${PROJECT_ID} --limit=50 --format='value(textPayload)'" >&2
    exit 1
  fi
fi

run_cmd gcloud run services update "$SERVICE_NAME" \
  --image="$IMAGE_BY_DIGEST" \
  --region="$REGION" \
  --project="$PROJECT_ID"

run_cmd gcloud run services update-traffic "$SERVICE_NAME" \
  --to-latest \
  --region="$REGION" \
  --project="$PROJECT_ID"

if [ "$DRY_RUN" = "1" ]; then
  SERVICE_URL="https://${SERVICE_NAME}-dryrun.a.run.app"
else
  SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
fi

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "SERVICE_URL=${SERVICE_URL}" >> "$GITHUB_ENV"
  echo "DEPLOYED_IMAGE=${IMAGE_BY_DIGEST}" >> "$GITHUB_ENV"
fi

echo "Release deployed: ${SERVICE_URL} (${IMAGE_BY_DIGEST})"
