# Lab 5 — Deployment (CI/CD, Docker, GCP)

Course Project Management System (CPMS) — CPE334 Theme 6

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-12 | ILoveSiesta | First version (#18): stack and changes from the starter kit, environment variables, Docker and local commands. CI (#19), GCP resources (#20), release procedure (#21) and persistence/rollback (#22) are added by their issues |
| 0.2 | 2026-11-12 | phet526 | CI specification and deploy scripts design (#19): `ci-docker.yml`, `deploy/` scripts (`deploy.sh`, `release.sh`, `smoke_test.py`, `teardown.sh`), offline tests |
| 0.3 | 2026-11-12 | phet526 | PR #24 review fixes: idempotent secret/DB-user creation in `deploy.sh`, 40-char SHA + `ROLLBACK=true` in `release.sh`, strict retry/credential handling in `smoke_test.py`, `teardown.sh` resource summary, pinned v7 Actions + Python `3.14`, and live C-01 CI run evidence |
| 0.4 | 2026-11-13 | phet526 | GCP resources specification, first Cloud Run deployment (`https://cpms-6pjdhtz32a-as.a.run.app`), verification evidence (C-04), and WIF keyless GitHub authentication setup (#20) |

Release being deployed: Sprint 1 `v0.1.0` (`25211ac`) plus the Lab 5 changes. Lab 5 Issues: #18–#22 (label `lab5`,
milestone "Lab 5"). Staging branch for Lab 5: `lab5-staging`.

## 1. Stack and changes from the starter kit

The reference stack and the kit (`toktickit-lab5-starter`) are used as the template:
Docker → GitHub Actions → Artifact Registry → Cloud Run (service + migration job) → Cloud SQL for PostgreSQL 16,
secrets in Secret Manager, keyless GitHub → GCP login with Workload Identity Federation.

| Area | Kit (TokTickIT) | CPMS | Why |
|---|---|---|---|
| Server runtime | Compiled `dist/`, `node dist/index.js` | TypeScript run with `tsx`: `node --import tsx src/index.ts` | The Sprint 1 release already runs with `tsx` (`npm start`); `npm run build` is a type-check only. Keeps the released behaviour; the seed also needs `tsx` |
| Entrypoint script | `server/docker-entrypoint.sh` (`exec "$@"`) | Not used; `CMD` starts `node` directly | `node` is already PID 1 and receives SIGTERM; one file less to keep with LF line endings |
| Compose | 4 services: `db`, `migrate`, `server`, `client` (nginx) | 3 services: `db`, `migrate`, `app` | `app` is the same root image that Cloud Run runs, so the local check tests the deployed image. No `server/Dockerfile`, `client/Dockerfile`, `client/nginx.conf` |
| Serving the UI | Express serves `/app/client/dist` | Same, through `CLIENT_DIST_DIR` (unset in `npm run dev`) | One container, same origin, no CORS setup |
| Secrets | `DATABASE_URL`, `ADMIN_PASSWORD`, `DEMO_USER_PASSWORD` | `DATABASE_URL`, `JWT_SECRET`, `SEED_DEMO_PASSWORD` | CPMS signs JWTs with `JWT_SECRET`; it has no administrator account; demo accounts (Student/Supervisor) are needed for Lab 6 UAT |
| Readiness | `/api/ready` | `/api/ready` (`{ status: "ready", db: "connected" }` or 503 `not_ready`) | Same contract as the kit's smoke test |
| Names | `toktickit*` | `cpms*` (see §4) | |

Design change recorded as CHG-02 in `docs/traceability.md` §5 and SDS §8.

### Episode 2 cloud-readiness checklist

| # | Check | CPMS |
|---|---|---|
| 1 | Uploaded files are not stored in a local folder | Already OK: no file upload; a submission stores a link |
| 2 | Seed is safe for production | Changed: `demoPasswordFrom()` requires `SEED_DEMO_PASSWORD` (the code fallback was removed); the seed uses upserts and is safe to re-run |
| 3 | No development shortcuts | Already OK: every user signs in; no role selector; no password shown on the login page |
| 4 | Sessions survive a redeploy / extra instance | Already OK: stateless JWT; logout revocations are stored in the database (`RevokedToken`) |
| 5 | Server reads `PORT` and is reachable | Already OK: `PORT` (default 3000), listens on all interfaces |
| 6 | `/api/ready` exists | Added: 200 when PostgreSQL answers, 503 otherwise, no internal details |

## 2. Environment variables

Every variable the app reads. Placeholders only; real values live in a local `.env` (git-ignored) or in Secret Manager.

| Variable | Read by | Purpose | Secret | Local (`npm run dev`) | Docker compose | CI (#19) | Cloud Run (#20) |
|---|---|---|---|---|---|---|---|
| `DATABASE_URL` | server, migrate/seed | PostgreSQL connection | **Yes** (on GCP) | `server/.env` | Set by compose (`db` host) | Workflow env (throw-away service DB) | Secret Manager `cpms-database-url` |
| `JWT_SECRET` | server | Signs auth tokens; required at start | **Yes** | `server/.env` | `server/.env` | Workflow env (throw-away value) | Secret Manager `cpms-jwt-secret` |
| `JWT_EXPIRES_IN` | server | Token lifetime | No | `server/.env` (`2h`) | `server/.env` | default `2h` | default `2h` |
| `SEED_DEMO_PASSWORD` | seed | Password of the synthetic demo accounts; seed refuses to run without it | **Yes** | `server/.env` | `server/.env` | Workflow env (throw-away value) | Secret Manager `cpms-demo-password` (migration job only) |
| `PORT` | server | Listening port | No | `3000` | `3000` | – | Set by Cloud Run (`3000`) |
| `NODE_ENV` | server, seed | `production` in the image | No | unset | `production` (image) | `test` (Vitest) | `production` |
| `CLIENT_DIST_DIR` | server | Folder of the built client served by the API | No | unset | `/app/client/dist` (image) | – | `/app/client/dist` (image) |
| `TZ` | runtime | Container time zone | No | – | `Asia/Bangkok` (image) | – | `Asia/Bangkok` |
| `TEST_DATABASE_URL` | server tests | Optional test DB; name must end in `_test` (default: `cpms_test` derived from `DATABASE_URL`) | No | optional | – | optional | – |
| `VITE_API_URL` | client build | API base; default `/api` | No | unset (Vite proxy) | unset (same origin) | unset | unset |

Example files: `server/.env.example`, `client/.env.example`. No `.env` file is copied into the image (`.dockerignore`).

## 3. Commands

### Local development (unchanged from Sprint 1)

```bash
cp server/.env.example server/.env      # then set your own local values
npm run db:up                           # PostgreSQL only
npm run prisma:migrate --prefix server
npm run prisma:seed --prefix server
npm run dev --prefix server             # http://localhost:3000
npm run dev --prefix client             # http://localhost:5173
```

### Build and test

```bash
npm run build          # type-check server, build client
npm test               # server (cpms_test database) + client tests
npm run test:e2e       # Playwright against the dev servers
```

### Docker (same image as Cloud Run)

Stop `npm run dev --prefix server` first: the `app` container uses port 3000.

```bash
cp server/.env.example server/.env      # only on a fresh clone
docker compose up --build -d            # db + migrate (once) + app
docker compose ps -a                    # db/app running, migrate "Exited (0)"
curl --fail http://localhost:3000/api/health
curl --fail http://localhost:3000/api/ready
# open http://localhost:3000 and sign in with a seeded account
docker compose down                     # keeps the cpms-db-data volume
docker compose up -d                    # data is still there
docker compose down -v                  # only to reset the database
```

Build the image alone (what CI checks): `docker build -t cpms-app:local .`

Migrate and seed inside the container (what the Cloud Run job runs):
`npm run prisma:deploy && npm run prisma:seed`

### Verified locally (2026-11-12, branch `refactor/lab5-cloud-ready`)

| Check | Result |
|---|---|
| `docker compose build` | Image `cpms-app:local` built (Node 24 alpine) |
| `docker compose up -d` | `migrate` exited 0 ("Seed completed successfully"); `app` running as user `node` (uid 1000) |
| `GET /api/health`, `GET /api/ready` | 200 `{"status":"ok",...}`, 200 `{"status":"ready","db":"connected"}` |
| `GET /`, `GET /supervisor/teams/1` | 200 `text/html` (built client, SPA fallback) |
| `GET /api/teams` without a token | 401 `UNAUTHENTICATED` |
| Journey via the container API | Supervisor creates a milestone (201), student submits (201, version 1), supervisor adds feedback (201); student creating a milestone → 403 |
| UI via the container | Student signs in at `http://localhost:3000/login` and sees the team and the new milestone |
| `docker compose down` → `up -d` | Same milestone, submission and feedback returned; another team's student → 404 |
| Fresh clone of `91dcdba` with only `cp server/.env.example server/.env` (separate compose project and volume) | `migrate` exited 0, `/api/ready` 200, `/` 200, seeded student signs in with the example password (C-03) |

## 4. GCP resources (#20)

Project `cpe334-cpms`, region `asia-southeast1`. First deployed from Cloud Shell via `deploy/deploy.sh --demo` (Episode 5).

- **Public Live URL:** <https://cpms-6pjdhtz32a-as.a.run.app>
- **Health Check:** `GET https://cpms-6pjdhtz32a-as.a.run.app/api/health` → `200 {"status":"ok","service":"CPMS API"}`
- **Readiness Check:** `GET https://cpms-6pjdhtz32a-as.a.run.app/api/ready` → `200 {"status":"ready","db":"connected"}`

### 4.1 Resource Inventory

| Resource | Name / Identifier | Configuration & Security Scope |
|---|---|---|
| Cloud Run service | `cpms` | Image `asia-southeast1-docker.pkg.dev/cpe334-cpms/cpms/cpms:latest`, port `3000`, `--min-instances=0`, `--max-instances=3`, memory `512Mi`, CPU `1`, `CLIENT_DIST_DIR=/app/client/dist`, `NODE_ENV=production`, `TZ=Asia/Bangkok`; Cloud SQL connection `cpe334-cpms:asia-southeast1:cpms-pg`; secrets `DATABASE_URL` (`cpms-database-url:latest`), `JWT_SECRET` (`cpms-jwt-secret:latest`); service account `cpms-runner`; public access (`allUsers` has `roles/run.invoker`) |
| Cloud Run migration job | `cpms-migrate` | Container command `sh -c "npx prisma migrate deploy && npm run prisma:seed"`, `NODE_ENV=production`, `TZ=Asia/Bangkok`; secrets `DATABASE_URL`, `SEED_DEMO_PASSWORD` (`cpms-demo-password:latest`); Cloud SQL connection `cpe334-cpms:asia-southeast1:cpms-pg`; service account `cpms-runner` |
| Artifact Registry repository | `cpms` | Docker format, Standard, location `asia-southeast1`; image path `asia-southeast1-docker.pkg.dev/cpe334-cpms/cpms/cpms` |
| Cloud SQL instance | `cpms-pg` | PostgreSQL 16.15 Enterprise, tier `db-f1-micro` (1 vCPU, 628.74 MB RAM, 10 GB SSD), backup window `03:00` ICT, storage auto-increase disabled (`storageAutoResize: false`); database `cpms`; user `cpms` |
| Secret Manager secrets | `cpms-database-url`<br>`cpms-jwt-secret`<br>`cpms-demo-password` | Injected into Cloud Run and the migration job; values generated randomly via OpenSSL on initial run and never committed or echoed in plain text; accessed only by `cpms-runner` |
| Runtime service account | `cpms-runner@cpe334-cpms.iam.gserviceaccount.com` | Minimum privilege: `roles/cloudsql.client` at project level; `roles/secretmanager.secretAccessor` granted specifically on `cpms-database-url`, `cpms-jwt-secret`, and `cpms-demo-password` |
| Deployer service account | `cpms-deployer@cpe334-cpms.iam.gserviceaccount.com` | Used by GitHub Actions keyless deployment: `roles/run.developer` at project level, `roles/artifactregistry.writer` on repository `cpms`, and `roles/iam.serviceAccountUser` on `cpms-runner`. **No service account keys** exist (`No rows to display`) |
| Workload Identity Federation | Pool: `github-actions`<br>Provider: `github-main` | OIDC issuer `https://token.actions.githubusercontent.com/`; attribute mappings: `google.subject=assertion.sub`, `attribute.repository_id=assertion.repository_id`; impersonation granted to `cpms-deployer` filtered by `repository_id=1445477852`; CEL condition restricted to this repo (`1445477852`), owner (`186724745`), `refs/heads/main`, `deploy.yml`, and environment `demo` |
| GitHub environment | `demo` | Restricted to branch `main` with deployment variables `GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT` (configured in #21) |

### 4.2 Verified Live Deployment Evidence (Episode 5 & C-04)

- **Cloud Shell first deployment (Episode 5.4–5.5):**
  - Storage auto-increase patched off: `gcloud sql instances patch cpms-pg --no-storage-auto-increase` → `Updated` (`storageAutoResize: false`).
  - Health & readiness check: `GET /api/health` answered 200, `GET /api/ready` answered 200 `{"status":"ready","db":"connected"}`.
  - Automated smoke test: `python3 deploy/smoke_test.py https://cpms-6pjdhtz32a-as.a.run.app` returned `PASS /api/health`, `PASS /api/ready`, `PASS /`, `PASS /api/teams (401 unauthenticated)`, `SKIP login: optional smoke credentials not configured`.
- **Public Domain Workflow (C-04 evidence):**
  - Public Cloud Run URL opened in web browser without Google sign-in.
  - Authenticated sign-in at `/login` with seeded supervisor account (`supervisor1@cpms.test`) loaded assigned teams (Team Alpha, Team Beta).
  - Main business action: created new milestone `Lab 5 Cloud Test` for Team Alpha; milestone persisted in PostgreSQL 16 and displayed under team milestones.
  - Business rule / validation rejection: blank milestone title submission rejected by client and server validation (`Required`).
- **GCP Console audit (Episode 5.7 & 6.2–6.3):**
  - `cpms-pg` configuration: PostgreSQL 16.15, `storageAutoResize: false`, database `cpms`.
  - `cpms` Cloud Run service: `min-instances=0`, `max-instances=3`, port 3000, environment variables and secret bindings intact.
  - `cpms-runner` IAM bindings restricted strictly to Cloud SQL Client and Secret Accessor.
  - `cpms-deployer` service account has zero JSON keys (`No rows to display`).
  - Workload Identity Federation provider `github-main` active under pool `github-actions` with repository and main branch CEL condition.

## 5. CI on pull requests (#19)

- **Workflow:** `.github/workflows/ci-docker.yml` (`CI & Docker Build`), job `test-and-docker`.
- **Triggers:** `pull_request` into `[main, lab5-staging]`, `workflow_call` (reused by `deploy.yml` in #21), and `workflow_dispatch`.
- **Permissions:** `contents: read` (read-only; never signs in to GCP), with `persist-credentials: false` on checkout. Actions are pinned to full commit SHAs (v7 tags) and maintained with `.github/dependabot.yml`.
- **Pipeline stages:**
  1. **PostgreSQL 16 service container** (`postgres:16-alpine`, database `cpms`).
  2. **Deploy-script checks (offline):** `bash -n deploy/deploy.sh deploy/release.sh deploy/teardown.sh`, `bash deploy/tests/test_deploy_stub.sh`, `bash deploy/tests/test_release_stub.sh`, and `python3 -m unittest discover -s deploy/tests` (Python `3.14`).
  3. **Backend (`server/`):** `npm ci`, `prisma generate`, `prisma migrate deploy`, `prisma:seed`, `npm run build`, and `npm test` (against `cpms_test`).
  4. **Frontend (`client/`):** `npm ci`, `npm test`, and `npm run build`.
  5. **E2E (`e2e/`):** `npm ci`, `npx playwright install --with-deps chromium`, and `npm run test:e2e`.
  6. **Docker verification:** `docker build -t cpms-app:ci .` (build only; never pushed in CI).
- **Deploy scripts (`deploy/`):** adapted to CPMS resource names (`cpe334-cpms`, `asia-southeast1`, `cpms`, `cpms-migrate`, `cpms-pg`, `cpms-runner`, `cpms-database-url`, `cpms-jwt-secret`, `cpms-demo-password`):
  - `deploy/deploy.sh`: idempotent first-time GCP setup + migration job + Cloud Run deploy; supports `DRY_RUN=1`, generates DB user/secrets only when missing in Secret Manager (`&schema=public&connection_limit=3`), prints redacted `+ ...` commands, prints `gcloud logging read` diagnostics on migration failure, and accepts `--demo` with no effect (always seeds/updates secrets idempotently). If an initial `secrets create` succeeds and `versions add` fails mid-run, delete the empty secret before re-running.
  - `deploy/release.sh`: validates 40-char hex commit SHA `IMAGE_TAG` and `ROLLBACK` (`true`/`false`), resolves image digest, skips migration when `ROLLBACK=true`, updates `cpms-migrate` / `cpms` via `gcloud run jobs update` + `services update` + `services update-traffic --to-latest` (without requiring `setIamPolicy`), and writes `SERVICE_URL` and `DEPLOYED_IMAGE` to `$GITHUB_ENV`; supports `DRY_RUN=1`.
  - `deploy/smoke_test.py`: read-only HTTP checks (`GET /api/health` 200, `GET /api/ready` 200, `GET /` 200 HTML, unauthenticated `GET /api/teams` 401) each with 5 × 3s retries including unexpected HTTP statuses; fails loudly if only one of `SMOKE_EMAIL`/`SMOKE_PASSWORD` is set; runs `POST /api/auth/logout` inside `finally:` and logs `WARN` (without failing the run, as JWTs expire in 2h) if logout fails.
  - `deploy/teardown.sh`: prints a list of all resources to be deleted before prompting for exact `PROJECT_ID` confirmation, with `DRY_RUN=1` preview and redacted `+ ...` logging.
- **Verified on branch `ci/lab5-pr-checks` (2026-11-12):**
  - Live PR CI runs (`C-01` evidence on PR #24, `CI & Docker Build / test-and-docker`):
    - Initial PR head (`d1327b3`): <https://github.com/ILoveSiesta/Course-Project-Management-System/actions/runs/43229756075> (passed in 1m56s: server 84/84, client 15/15, Playwright E2E 3/3, `docker build` passed).
    - Post-review head (`774cde0`): <https://github.com/ILoveSiesta/Course-Project-Management-System/actions/runs/43234818752> (passed in 1m52s, including `bash -n`, `test_deploy_stub.sh`, `test_release_stub.sh`, 8/8 `test_smoke.py`, server 84/84, client 15/15, Playwright E2E 3/3, and `docker build`).
  - Offline script checks after PR #24 review fixes: `bash -n`, `test_deploy_stub.sh` (including fake-`gcloud` re-run idempotency test), `test_release_stub.sh` (including `ROLLBACK=true` and invalid tag/rollback checks), and `test_smoke.py` (8/8 unittest cases).
  - `python deploy/smoke_test.py http://localhost:3000` against `docker compose up -d` → `PASS /api/health`, `PASS /api/ready`, `PASS /`, `PASS /api/teams (401 unauthenticated)`, `SKIP login`.

## 6. Release procedure (#21), persistence and rollback (#22)

To be completed by those issues.
