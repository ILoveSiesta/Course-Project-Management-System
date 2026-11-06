# System-Level Software Design Specification (SDS)

Course Project Management System — CPE334 Theme 6

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |
| 0.2 | 2026-11-04 | ILoveSiesta | First full draft (Sprint 1 in detail, Sprint 2–3 direction only), based on SRS v0.3. Owner of this document per issue #1: ILoveSiesta; reviewer: phet526 |
| 0.3 | 2026-11-05 | ILoveSiesta | §3.2: shared visual style (`client/src/theme.css`) brought into Sprint 1 (PR #9) |
| 0.4 | 2026-11-06 | ILoveSiesta | §5: team management row no longer waits for TA confirmation (D-06 Agreed) |

Requirement IDs (FR/BR/NFR/D) refer to `docs/srs.md`. Feature contracts in `docs/sprints/sprint-N/` give the
exact endpoint request/response shapes; this document defines the shared structure and conventions they follow.

## 1. Architecture and stack

### 1.1 Components

```mermaid
flowchart LR
  B["Browser<br/>React SPA"] -- "HTTPS JSON<br/>Authorization: Bearer token" --> A
  subgraph A["API server (Node.js + Express)"]
    MW["middleware<br/>authenticate · requireRole"] --> R["routes<br/>HTTP + input parsing"] --> S["services<br/>business rules + access scope"]
  end
  S -- "Prisma ORM" --> D[("PostgreSQL")]
```

| Component | Technology | Responsibility |
|---|---|---|
| UI | React 18, Vite, TypeScript, React Router | Screens, navigation, client-side form hints, showing API errors. Holds the access token for the session. **Never** the authority for permissions or rules. |
| API / application | Node.js, Express 4, TypeScript (ESM, `tsx`) | Authentication, role checks, record-scope checks, validation and all business rules (BR-01..BR-10). Returns JSON only. |
| Data access | Prisma 5 | Schema, migrations, typed queries, transactions. |
| Database | PostgreSQL 16 | Durable storage; constraints (unique, foreign keys, not-null) as a backstop for the rules enforced in services. |
| Tests | Vitest + Supertest (API/integration on a real PostgreSQL), Vitest + Testing Library (UI), Playwright (E2E) | See section 9. |

It is a modular monolith: one API process and one database. In production the API also serves the built
SPA (section 8), so the browser talks to a single origin.

### 1.2 Server code layout

```
server/src/
  app.ts            Express app: JSON parsing, routers, 404, safe error handler
  index.ts          Process entry (listen on PORT)
  prisma.ts         Lazy PrismaClient singleton
  middleware/       authenticate (token → req.user), requireRole(role)
  routes/           One router per area (auth, teams, milestones, submissions, feedback): parse input, call a service, map result to HTTP
  services/         Business rules and record-scope checks; the only place that decides "may this user do this to this record?"
  utils/            Pure helpers (e.g. daysLate calculation, URL validation) — unit tested
```

### 1.3 Where rules are enforced

| Rule type | Enforced in | Backstop |
|---|---|---|
| Authentication (401) | `authenticate` middleware on every route except login and health | — |
| Role permissions (403) | `requireRole` on the route | — |
| Record scope: own team / assigned team (BR-01, BR-02) | Service, by resolving the record's team and checking membership/assignment for `req.user` | — |
| Field validation (BR-04, BR-08) | Service (shared validators in `utils/`) | DB column lengths / not-null |
| Version numbering and limit (BR-06, BR-07) | Service, inside a transaction that locks the milestone row | Unique (`milestoneId`, `version`) |
| Late calculation (BR-05) | Service at insert time, using server time | Check `daysLate >= 0` |
| One team per student (BR-10) | Seed (Sprint 1), service (Sprint 3) | Unique `TeamMembership.studentId` |
| Feedback immutability (BR-09) | No update/delete endpoints exist | — |

The UI may hide controls that a role cannot use, but this is only for usability; every request is checked again
by the API.

## 2. Data model

### 2.1 Entity–relationship diagram (Sprint 1)

```mermaid
erDiagram
  User ||--o| TeamMembership : "is member (student)"
  Team ||--o{ TeamMembership : has
  User ||--o{ SupervisorAssignment : "supervises (supervisor)"
  Team ||--o{ SupervisorAssignment : "is supervised by"
  Team ||--o{ Milestone : has
  User ||--o{ Milestone : "created by"
  Milestone ||--o{ Submission : receives
  User ||--o{ Submission : "submitted by"
  Submission ||--o{ Feedback : has
  User ||--o{ Feedback : "written by"
```

`RevokedToken` stands alone (keyed by token ID) and supports logout (section 6).

### 2.2 Entities

All `id` columns are auto-increment integers. All timestamps are `timestamptz` stored in UTC (A-04).

| Entity | Fields | Constraints and notes | Added by |
|---|---|---|---|
| **User** | `id`, `email`, `name`, `role` (`STUDENT` \| `SUPERVISOR`), `passwordHash`, `createdAt` | `email` unique, stored lower-case; `passwordHash` is a bcrypt hash (NFR-01) | F-01 |
| **RevokedToken** | `jti` (PK), `expiresAt` | Inserted on logout; rows past `expiresAt` may be purged | F-01 |
| **Team** | `id`, `name`, `createdAt` | `name` unique | F-01 |
| **TeamMembership** | `id`, `teamId` → Team, `studentId` → User, `createdAt` | `studentId` unique (BR-10); user must have role `STUDENT` (checked by seed/service) | F-01 |
| **SupervisorAssignment** | `id`, `teamId` → Team, `supervisorId` → User, `createdAt` | unique (`teamId`, `supervisorId`); user must have role `SUPERVISOR`; a team may have several (D-04) | F-01 |
| **Milestone** | `id`, `teamId` → Team, `title` (≤ 120), `description` (≤ 2000, nullable), `deadline`, `createdById` → User, `createdAt` | index (`teamId`, `deadline`); deadline in the future at creation (BR-04, service) | F-02 |
| **Submission** | `id`, `milestoneId` → Milestone, `submittedById` → User, `version`, `title` (≤ 120), `description` (≤ 2000, nullable), `link` (≤ 2048), `submittedAt`, `daysLate` | unique (`milestoneId`, `version`); `version` 1..3 (BR-06, BR-07); `daysLate >= 0` (BR-05); never updated or deleted | F-03 |
| **Feedback** | `id`, `submissionId` → Submission, `authorId` → User, `comment` (1–5000), `createdAt` | append-only, no update/delete (BR-09); several entries per submission allowed (D-08) | F-04 |

**Ownership links.** A record's team decides who may see it: Milestone → `teamId`; Submission → its milestone's
team; Feedback → its submission's milestone's team. A milestone belongs to exactly one team, so a submission
needs no separate `teamId`.

Foreign keys use `ON DELETE RESTRICT`: no Sprint 1 operation deletes teams, milestones, submissions or feedback.

### 2.3 Planned additions (Sprint 2–3, direction only)

- Grades and grade release (FR-18, FR-19): a grade per team–milestone and a release marker on the milestone. Exact fields in the Sprint 2 contract.
- Team–milestone status (FR-20, BR-12) is **derived** from existing data, not stored.
- Team management (FR-07, Sprint 3) reuses `Team`, `TeamMembership` and `SupervisorAssignment`.

### 2.4 Migrations and seed data

- Each feature adds its models with one Prisma migration named after the feature, e.g. `prisma migrate dev --name f01_auth_teams`. Migrations are committed under `server/prisma/migrations/` and never edited after merge.
- Deployments apply migrations with `prisma migrate deploy`.
- `server/prisma/seed.ts` is **idempotent** (upserts by e-mail / team name) and creates synthetic data only:

| Team | Students | Supervisors |
|---|---|---|
| Team Alpha | student1, student2 | supervisor1 |
| Team Beta | student3, student4 | supervisor1, supervisor2 |
| Team Gamma | student5, student6 | supervisor2 |

  Accounts use e-mails like `student1@cpms.test` and the password given by `SEED_DEMO_PASSWORD` (section 7). This layout gives every access test a counterpart: a supervisor with two teams, a team with two supervisors, and a supervisor who is **not** assigned to a team (supervisor2 → Team Alpha). Later features extend the seed with sample milestones, submissions and feedback.

## 3. UI structure and conventions

### 3.1 Screens and navigation (Sprint 1)

```mermaid
flowchart TD
  L["/login"] -->|Student| SH["/student — My team<br/>team, members, milestones"]
  L -->|Supervisor| PH["/supervisor — My teams"]
  SH --> SM["/student/milestones/:id<br/>submit · versions · feedback"]
  PH --> PT["/supervisor/teams/:id<br/>members · milestones · create milestone"]
  PT --> PM["/supervisor/milestones/:id<br/>versions · add feedback"]
```

| Screen | Role | Purpose | Feature |
|---|---|---|---|
| Login | All | E-mail + password; on success go to the role's home | F-01 |
| My team | Student | Team name, members, supervisors; milestone list by deadline | F-02 |
| Student milestone detail | Student | Submit / resubmit form; list of versions with late badge and days late; feedback on each version | F-03, F-04 |
| My teams | Supervisor | Assigned teams with members | F-02 |
| Supervisor team detail | Supervisor | Milestone list; create-milestone form | F-02 |
| Supervisor milestone detail | Supervisor | Versions with late badge; add feedback to a version | F-03, F-04 |

A header on every signed-in page shows the user's name, role and a **Log out** button. Visiting a page for the
other role redirects to the user's own home.

### 3.2 Shared UI behaviour

| State | Behaviour |
|---|---|
| Loading | A loading indicator replaces the content area; buttons that submit are disabled while a request is in flight |
| Empty | A short message, e.g. "No milestones yet" or "No submissions yet" |
| Validation | Field-level messages next to inputs. The client checks required fields and lengths for convenience; the API's `VALIDATION_ERROR` details are shown per field |
| Rule rejection | Message from the API error (NFR-12), e.g. "Maximum of 3 versions reached" |
| 401 from any call | Clear the token and go to `/login` with "Your session has ended" |
| 403 / 404 | A "Not found or not allowed" page; never shows partial data |
| Times | Displayed in Asia/Bangkok with the zone shown (A-04) |
| Visual style | One shared stylesheet, `client/src/theme.css`, defines colour tokens, typography and reusable classes (app header/main/footer, `card`, `badge`, `form-field` with `has-error`, `field-error`, `btn`/`btn-secondary`, `alert`, `empty-state`, `milestone-list`). Components use these classes, not inline styles, so every feature looks consistent. Responsive verification at 375 px / 1280 px remains Sprint 3 (SR-06, NFR-11). |

## 4. API conventions

- Base path `/api`; JSON request and response bodies; UTF-8.
- Authentication with `Authorization: Bearer <token>` on every endpoint except `POST /api/auth/login` and `GET /api/health`.
- Timestamps are ISO 8601 strings in UTC (e.g. `2026-11-08T16:59:00.000Z`).
- Resource IDs appear in the path; the acting user always comes from the token, never from the body or query.
- Success: `200` (read), `201` (created, body = created resource), `204` (logout).
- Errors always use:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Link must be an http or https URL", "details": { "link": "INVALID_URL" } } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid fields (`details` maps field → reason) |
| 401 | `UNAUTHENTICATED` | No, malformed, expired or revoked token |
| 401 | `INVALID_CREDENTIALS` | Login failed (same response for unknown e-mail and wrong password) |
| 403 | `FORBIDDEN` | The user's role may not call this operation |
| 404 | `NOT_FOUND` | Record does not exist **or** is outside the user's scope (no disclosure) |
| 409 | `VERSION_LIMIT_REACHED` | 4th submission for a milestone (BR-07) |
| 500 | `INTERNAL_ERROR` | Unexpected error; details only in server logs (NFR-05) |

**Check order** for every protected request: authenticate (401) → role (403) → record scope (404) → validation
(400) → business rule (409). Scope is checked before validation so that probing another team's records never
reveals whether they exist.

### 4.1 Sprint 1 endpoint overview

Exact request/response shapes are defined in each feature contract.

| Method | Path | Role | Feature |
|---|---|---|---|
| POST | `/api/auth/login` | — | F-01 |
| POST | `/api/auth/logout` | Any | F-01 |
| GET | `/api/auth/me` | Any | F-01 |
| GET | `/api/teams` | Any (student: own team; supervisor: assigned teams) | F-02 |
| GET | `/api/teams/:teamId` | Any, in scope | F-02 |
| GET | `/api/teams/:teamId/milestones` | Any, in scope | F-02 |
| POST | `/api/teams/:teamId/milestones` | Supervisor, assigned | F-02 |
| GET | `/api/milestones/:milestoneId` | Any, in scope | F-02 |
| GET | `/api/milestones/:milestoneId/submissions` | Any, in scope | F-03 |
| POST | `/api/milestones/:milestoneId/submissions` | Student, own team | F-03 |
| GET | `/api/submissions/:submissionId` | Any, in scope (includes feedback) | F-03, F-04 |
| POST | `/api/submissions/:submissionId/feedback` | Supervisor, assigned | F-04 |

## 5. Roles and permissions

"Own team" = the team the student belongs to. "Assigned" = a team the supervisor has a `SupervisorAssignment` for.
Out-of-scope reads return 404; operations the role may never perform return 403.

| Operation | Student | Supervisor | Sprint |
|---|---|---|---|
| Log in / log out / view own identity | ✅ | ✅ | 1 |
| View team, members, supervisors | Own team | Assigned teams | 1 |
| View milestones | Own team | Assigned teams | 1 |
| Create milestone | ❌ 403 | Assigned teams | 1 |
| Submit / resubmit work | Own team | ❌ 403 | 1 |
| View submissions and versions | Own team | Assigned teams | 1 |
| Record feedback | ❌ 403 | Assigned teams | 1 |
| View feedback | Own team | Assigned teams | 1 |
| Edit / extend milestone | ❌ | Assigned teams | 2 |
| Record / release grade | ❌ | Assigned teams | 2 |
| View grade | Own team, after release | Assigned teams | 2 |
| Progress board, reports, filters | Own team | Assigned teams | 3 |
| Manage teams and members | ❌ | Teams they supervise (D-06) | 3 |

## 6. Authentication and session lifecycle

| Step | Design |
|---|---|
| Password storage | `bcryptjs` hash with cost 10 (NFR-01). Plain passwords exist only in the seed's input and in the login request body. |
| Login | `POST /api/auth/login { email, password }`. E-mail is lower-cased and looked up; the hash is compared with `bcrypt.compare`. Failure for any reason returns `401 INVALID_CREDENTIALS` with the same message. Success returns `200 { token, user: { id, name, email, role } }`. |
| Token | JWT signed with HS256 using `JWT_SECRET`. Claims: `sub` (user id), `role`, `jti` (random UUID), `iat`, `exp`. Lifetime `JWT_EXPIRES_IN` = 2 h (NFR-04). |
| Client storage | The SPA keeps the token in `sessionStorage` (cleared when the tab closes) and sends it as a Bearer header. |
| Each request | `authenticate` verifies signature and expiry, rejects the token if its `jti` is in `RevokedToken`, loads the user from the database and sets `req.user = { id, role }`. A deleted user or invalid token → 401. |
| Current user | `GET /api/auth/me` returns `req.user`'s profile from the database. |
| Logout | `POST /api/auth/logout` inserts the token's `jti` and `exp` into `RevokedToken` and returns 204 (D-09). The client deletes the stored token. Any later request with that token → 401. |
| Expiry | After 2 h the token is rejected; the UI redirects to login. There is no refresh token in Sprint 1. |

## 7. Configuration

Configuration comes from environment variables. Real values live only in local `.env` files (git-ignored) or the
deployment's secret store; the repository contains `.env.example` files with safe placeholders.

| Variable | Component | Purpose | Example (non-secret) |
|---|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string | `postgresql://cpms:cpms@localhost:5432/cpms?schema=public` |
| `PORT` | server | API port | `3000` |
| `JWT_SECRET` | server | Token signing key; long random value; **secret** | (never committed) |
| `JWT_EXPIRES_IN` | server | Token lifetime | `2h` |
| `SEED_DEMO_PASSWORD` | server (seed only) | Password for synthetic demo accounts | (local value; shared privately) |
| `VITE_API_URL` | client (build time) | API base URL | `/api` |

The server refuses to start if `JWT_SECRET` or `DATABASE_URL` is missing. Tests use a separate database
(`DATABASE_URL` pointing to `cpms_test`).

## 8. Deployment plan (GCP)

Implemented in Lab 5; this is the target design.

```mermaid
flowchart LR
  GH["GitHub<br/>PR → CI build + tests"] -->|"merge to main<br/>(manual approval)"| AR["Artifact Registry<br/>Docker image"]
  AR --> CR["Cloud Run<br/>API + built SPA"]
  CR -->|"Cloud SQL connector"| SQL[("Cloud SQL<br/>PostgreSQL")]
  SM["Secret Manager<br/>JWT_SECRET, DB password"] --> CR
```

| Item | Plan |
|---|---|
| Image | One multi-stage Dockerfile: build client (`vite build`) and server; runtime image runs the API and serves the client's static files from the same origin |
| Start-up | Container runs `prisma migrate deploy`, then starts the API |
| Database | Cloud SQL for PostgreSQL — durable across restarts and redeployments (NFR-08) |
| Secrets | Secret Manager injected as environment variables; never in the image or Git |
| CI/CD | GitHub Actions: build + all automated tests on every PR (required check, NFR-09); on merge to `main`, build image and deploy after a manual approval step |
| Local parity | `docker-compose.yml` already provides PostgreSQL; Lab 5 adds the app service |

## 9. Test strategy

| Level | Tool | Scope | Location |
|---|---|---|---|
| Unit | Vitest | Pure rules: `daysLate`, URL/length validation, version selection | `server/tests/unit/` |
| API / integration | Vitest + Supertest + real PostgreSQL test DB | Endpoints, persistence, 401/403/404 access tests, concurrency (NFR-06) | `server/tests/api/` |
| UI component | Vitest + Testing Library | Forms, states, error display | `client/tests/` |
| End-to-end | Playwright | Critical journeys and one rejection journey (issue #6) | `e2e/` |

Integration tests reset the test database and reseed before each test file. Test IDs in each feature's STS map
to test names so results can be traced to acceptance criteria.
