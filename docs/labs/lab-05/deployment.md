# Lab 5 — Deployment (CI/CD, Docker, GCP)

Course Project Management System (CPMS) — CPE334 Theme 6

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-12 | ILoveSiesta | First version (#18): stack and changes from the starter kit, environment variables, Docker and local commands. CI (#19), GCP resources (#20), release procedure (#21) and persistence/rollback (#22) are added by their issues |

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

## 4. GCP resources (filled in #20)

Project `cpe334-cpms`, region `asia-southeast1`.

| Resource | Name |
|---|---|
| Cloud Run service | `cpms` |
| Cloud Run migration job | `cpms-migrate` |
| Artifact Registry repository / image | `cpms` / `cpms` |
| Cloud SQL instance / database / user | `cpms-pg` / `cpms` / `cpms` |
| Secrets | `cpms-database-url`, `cpms-jwt-secret`, `cpms-demo-password` |
| Service accounts | `cpms-runner` (runtime), `cpms-deployer` (GitHub Actions) |
| GitHub environment / required check | `demo` / `test-and-docker` |

## 5. CI (#19), release procedure (#21), persistence and rollback (#22)

To be completed by those issues.
