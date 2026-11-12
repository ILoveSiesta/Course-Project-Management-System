#!/usr/bin/env bash
set -euo pipefail

# One-time GCP setup and first deployment for CPMS (Lab 5 Episode 5).
# Adapts the Lab 5 Starter Kit to CPMS (Node.js, Prisma, Cloud SQL Postgres 16, Cloud Run).
# Supports DRY_RUN=1 to print the exact plan without calling GCP.

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-southeast1}"
DRY_RUN="${DRY_RUN:-0}"

for arg in "$@"; do
  case "$arg" in
    --demo) ;; # CPMS seed creates demo accounts via SEED_DEMO_PASSWORD in Secret Manager
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is required (e.g. PROJECT_ID=cpe334-cpms)." >&2
  exit 1
fi

REPO_NAME="cpms"
SQL_INSTANCE="cpms-pg"
DB_NAME="cpms"
DB_USER="cpms"
SERVICE_NAME="cpms"
MIGRATE_JOB_NAME="cpms-migrate"
SA_NAME="cpms-runner"

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_CONN_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

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

store_secret_version() {
  local secret_name="$1"
  local secret_value="$2"

  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] gcloud secrets create ${secret_name} --replication-policy=automatic --project=${PROJECT_ID}"
    echo "[DRY_RUN] printf '<REDACTED>' | gcloud secrets versions add ${secret_name} --data-file=- --project=${PROJECT_ID}"
    echo "[DRY_RUN] gcloud secrets add-iam-policy-binding ${secret_name} --member=serviceAccount:${SA_EMAIL} --role=roles/secretmanager.secretAccessor --project=${PROJECT_ID}"
    return 0
  fi

  if ! gcloud secrets describe "$secret_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" --replication-policy=automatic --project="$PROJECT_ID"
  fi
  printf '%s' "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=- --project="$PROJECT_ID"
  gcloud secrets add-iam-policy-binding "$secret_name" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" \
    --quiet
}

echo "========================================"
echo "CPMS Cloud Run Deployment"
echo "Project : $PROJECT_ID"
echo "Region  : $REGION"
echo "Dry Run : $DRY_RUN"
echo "========================================"

# 1. Enable required Google APIs
run_cmd gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project="$PROJECT_ID"

# 2. Create Artifact Registry Docker repository
if [ "$DRY_RUN" = "1" ] || ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="CPMS Docker repository" \
    --project="$PROJECT_ID"
fi

# 3. Create Cloud SQL for PostgreSQL 16 instance (db-f1-micro requires --edition=enterprise)
if [ "$DRY_RUN" = "1" ] || ! gcloud sql instances describe "$SQL_INSTANCE" --project="$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition=enterprise \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-type=SSD \
    --backup-start-time=03:00 \
    --project="$PROJECT_ID"
fi

# 4. Create application database
if [ "$DRY_RUN" = "1" ] || ! gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project="$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud sql databases create "$DB_NAME" \
    --instance="$SQL_INSTANCE" \
    --project="$PROJECT_ID"
fi

# 5. Create runtime service account and grant Cloud SQL Client role
if [ "$DRY_RUN" = "1" ] || ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud iam service-accounts create "$SA_NAME" \
    --display-name="CPMS Cloud Run Service Account" \
    --project="$PROJECT_ID"
fi

run_cmd gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None \
  --quiet

# 6. Generate secrets & DB user, then store in Secret Manager (never printed)
if [ "$DRY_RUN" = "1" ]; then
  DB_PASS="<REDACTED>"
  JWT_SECRET_VALUE="<REDACTED>"
  DEMO_PASS_VALUE="<REDACTED>"
  run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="<REDACTED>" --project="$PROJECT_ID"
else
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  JWT_SECRET_VALUE="$(openssl rand -hex 32)"
  DEMO_PASS_VALUE="${SEED_DEMO_PASSWORD:-$(openssl rand -base64 16 | tr -d '/+=' | cut -c1-16)}"
  if gcloud sql users list --instance="$SQL_INSTANCE" --project="$PROJECT_ID" --format="value(name)" | grep -Fxq "$DB_USER"; then
    gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project="$PROJECT_ID"
  else
    gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project="$PROJECT_ID"
  fi
fi

DB_URL_VALUE="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN_NAME}"

store_secret_version "$SECRET_DB_URL" "$DB_URL_VALUE"
store_secret_version "$SECRET_JWT_SECRET" "$JWT_SECRET_VALUE"
store_secret_version "$SECRET_DEMO_PASS" "$DEMO_PASS_VALUE"

# 7. Build container image with Cloud Build
run_cmd gcloud builds submit \
  --tag="$IMAGE_URI" \
  --project="$PROJECT_ID"

# 8. Create/Update & execute Cloud Run migration job
JOB_SECRETS="DATABASE_URL=${SECRET_DB_URL}:latest,SEED_DEMO_PASSWORD=${SECRET_DEMO_PASS}:latest"

run_cmd gcloud run jobs deploy "$MIGRATE_JOB_NAME" \
  --image="$IMAGE_URI" \
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

# 9. Deploy Cloud Run service
SERVICE_SECRETS="DATABASE_URL=${SECRET_DB_URL}:latest,JWT_SECRET=${SECRET_JWT_SECRET}:latest"

run_cmd gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE_URI" \
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

echo "========================================"
echo "Deployment Completed!"
if [ "$DRY_RUN" != "1" ]; then
  SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
  echo "Service URL      : ${SERVICE_URL}"
  echo "Health Check     : ${SERVICE_URL}/api/health"
  echo "Readiness Check  : ${SERVICE_URL}/api/ready"
  echo "Secrets stored   : ${SECRET_DB_URL}, ${SECRET_JWT_SECRET}, ${SECRET_DEMO_PASS} (not printed)"
fi
echo "========================================"
