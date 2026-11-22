# System-Level Software Design Specification (SDS)

Course Project Management System — CPE334 Theme 6

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |
| 0.2 | 2026-11-04 | ILoveSiesta | First full draft (Sprint 1 in detail, Sprint 2–3 direction only), based on SRS v0.3. Owner of this document per issue #1: ILoveSiesta; reviewer: phet526 |
| 0.3 | 2026-11-05 | ILoveSiesta | §3.2: shared visual style (`client/src/theme.css`) brought into Sprint 1 — change CHG-01 in `docs/traceability.md` §5 |
| 0.4 | 2026-11-06 | ILoveSiesta | §5: team management row no longer waits for TA confirmation (D-06 Agreed) |
| 0.5 | 2026-11-12 | ILoveSiesta | §7 variables for the container (`NODE_ENV`, `CLIENT_DIST_DIR`, `TEST_DATABASE_URL`; seed requires `SEED_DEMO_PASSWORD`); §8 Lab 5 design: migrations in a separate job, deploy on merge to `main` without a manual step, `/api/ready` — change CHG-02 in `docs/traceability.md` §5 (#18) |
| 0.6 | 2026-11-21 | ILoveSiesta | §3.1 supervisor milestone detail can edit/extend the milestone; §4 error `409 DEADLINE_NOT_EXTENDED`; §4.1 Sprint 2 endpoint `PATCH /api/milestones/:milestoneId`; §5 edit/extend row is 403 for students (F-05, #62) |
| 0.7 | 2026-11-21 | ILoveSiesta | Lab 7 change request #59 (CHG-03): §1.3 late rule includes the 7-day window, checked in the same locked transaction after the version limit; §4 error `409 SUBMISSION_WINDOW_CLOSED` and order of the two 409 rules. No change to architecture, data model, endpoints, roles, configuration or deployment |
| 0.8 | 2026-11-21 | ILoveSiesta | F-06 (#63): §3.1 supervisor team detail can create a milestone for several assigned teams; §4.2 endpoint `POST /api/milestones` (all-or-nothing, one transaction); §5 row for the multi-team create |
| 0.9 | 2026-11-21 | ILoveSiesta | F-08 (#66): §2.1/§2.2 `Grade` entity and `Milestone.gradesReleasedAt` (migration `f08_grades`); §2.3 grades no longer planned; §3.1 grade card on both milestone detail screens; §4 errors `NOTHING_TO_GRADE`, `GRADE_RELEASED`, `NO_GRADE`; §4.2 grade endpoints; §5 grade rows (student 403) |
| 0.10 | 2026-11-21 | phet526 | F-07 (#64): §3.1 dedicated Revision history screen (`/student/milestones/:id/history`, `/supervisor/milestones/:id/history`); §4.2 endpoint `GET /api/milestones/:milestoneId/history`; §5 row for viewing revision history |
| 0.11 | 2026-11-21 | phet526 | F-09 (#67): §3.1 student My team and supervisor team detail show derived status badges on milestone lists; §4.2 milestone endpoints include derived `status` without storing it |
| 0.12 | 2026-11-22 | phet526 | F-13 (#83): §3.1 supervisor dashboard team creation and supervisor team detail member add/remove; §4 errors `TEAM_NAME_EXISTS`, `STUDENT_ALREADY_IN_TEAM`; §4.3 F-13 team management endpoints; §5 updated row for team management (`403` for students) |
| 0.13 | 2026-11-22 | phet526 | F-13 (#83) §2.4: `seed.ts` creates baseline student `TeamMembership` rows only when first creating each student account so F-13 membership changes survive release `cpms-migrate` re-seeds (`prisma migrate reset` restores demo layout) |
| 0.14 | 2026-11-22 | phet526 | F-13 (#83) §1.3: `createSubmission` re-checks `TeamMembership` with `FOR SHARE` inside the milestone-locked transaction so a concurrent member removal rejects an in-flight submission (`BR-01`, `BR-14`) |
| 0.15 | 2026-11-22 | ILoveSiesta | Sprint 3 contracts (#84): §4.3 one Sprint 3 table with the planned endpoints and screens of F-10, F-11, F-12; §5 the progress board is for both roles while the summary report and submission filters are supervisor-only (FR-22, FR-23) (renumbered from 0.12 after F-13 PR #88 took 0.12–0.14) |
| 0.16 | 2026-11-22 | phet526 | Defect #90 (`DEF-BAD-INPUT`): §4 add `400 BAD_REQUEST`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, document pre-auth request parsing order, shared text-character rule (`INVALID_CHARACTER` for NUL `U+0000` and unpaired UTF-16 surrogates) and milestone year range (`1–9999` → `INVALID_DATE`); §9.1 regression test IDs (`TEST-90-U01..U03`, `TEST-90-01..13`) |
| 0.17 | 2026-11-22 | phet526 | Address PR #91 review: §4 cover undecodable `gzip`/`deflate` stream errors (`Z_DATA_ERROR`/`Z_BUF_ERROR`/`Z_NEED_DICT` → `400 BAD_REQUEST` `"Request body could not be read"`), correct request check order so body parsing precedes auth (`401`) while URL parameter decoding (`%zz`) runs after auth (`401`) and before role (`403`); update §6 login 400 rule and §9.1 (`TEST-90-14`, `TEST-90-UI01..06`) |
| 0.18 | 2026-11-22 | phet526 | Address PR #91 round-3 review: clarify in §4 that missing, non-JSON, or array login bodies return `400 VALIDATION_ERROR` while JSON primitives including `null` return `400 BAD_REQUEST` |
| 0.19 | 2026-11-23 | phet526 | Defect #92 (`DEF-SERVER-ERR`): §4 preserve client 4xx HTTP errors (`416`/`412`, `expose: true`) emitted by `express.static` / `sendFile` when `CLIENT_DIST_DIR` is enabled without leaking paths or stack traces; §6 forward DB/unexpected errors in `authenticate` to `500 INTERNAL_ERROR` (logged), make concurrent `logout` revocation race-safe (`204`), run dummy cost-10 `bcrypt.compare` for unknown emails, and ensure malformed login JSON does not log raw bodies/passwords; add §9.2 (`TEST-01-15..18`, `TEST-92-01`) |

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
| Record scope: own team / assigned team (BR-01, BR-02) | Service, by resolving the record's team and checking membership/assignment for `req.user`; `createSubmission` also re-checks `TeamMembership` with `FOR SHARE` inside the milestone-locked transaction so a concurrent F-13 member removal rejects an in-flight submission (`BR-14`) | — |
| Field validation (BR-04, BR-08) | Service (shared validators in `utils/`) | DB column lengths / not-null |
| Version numbering and limit (BR-06, BR-07) | Service, inside a transaction that locks the milestone row | Unique (`milestoneId`, `version`) |
| Late calculation and 7-day late window (BR-05, rev. CHG-03) | Service at insert time, using server time and the deadline read in the locked transaction; window checked after the version limit (pure helpers in `utils/submissionValidation.ts`) | Check `daysLate >= 0` (no upper-bound constraint: rows stored before CHG-03 may exceed 7) |
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
  Milestone ||--o| Grade : "graded (Sprint 2)"
  Submission ||--o{ Grade : "graded version"
  User ||--o{ Grade : "graded by"
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
| **Grade** | `id`, `milestoneId` → Milestone, `submissionId` → Submission, `score`, `gradedById` → User, `createdAt`, `updatedAt` | `milestoneId` unique (one grade per milestone); submission must belong to the same milestone (service); `score` 0–100 (DB check); updated until release, then locked (BR-11) | F-08 |
| **Milestone** (F-08 column) | `gradesReleasedAt` (nullable) | set once on release; never cleared (BR-11) | F-08 |

**Ownership links.** A record's team decides who may see it: Milestone → `teamId`; Submission → its milestone's
team; Feedback → its submission's milestone's team. A milestone belongs to exactly one team, so a submission
needs no separate `teamId`.

Foreign keys use `ON DELETE RESTRICT`: no Sprint 1 operation deletes teams, milestones, submissions or feedback.

### 2.3 Planned additions (Sprint 2–3, direction only)

- ~~Grades and grade release (FR-18, FR-19)~~ — added by F-08 (§2.2).
- Team–milestone status (FR-20, BR-12) is **derived** from existing data, not stored.
- Team management (FR-07, Sprint 3) reuses `Team`, `TeamMembership` and `SupervisorAssignment`.

### 2.4 Migrations and seed data

- Each feature adds its models with one Prisma migration named after the feature, e.g. `prisma migrate dev --name f01_auth_teams`. Migrations are committed under `server/prisma/migrations/` and never edited after merge.
- Deployments apply migrations with `prisma migrate deploy`.
- `server/prisma/seed.ts` is **idempotent** (upserts by e-mail / team name) and creates synthetic data only. It creates the baseline teams first and inserts each student's baseline `TeamMembership` only inside that student account's `create` branch (`update` leaves memberships untouched), so supervisor-managed moves and removals (F-13) survive release `cpms-migrate` re-runs (`NFR-08`); `prisma migrate reset` restores the demo layout:

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
| My team | Student | Team name, members, supervisors; milestone list by deadline with derived status badge | F-02, F-09 |
| Student milestone detail | Student | Submit / resubmit form; list of versions with late badge and days late; feedback on each version; grade after release | F-03, F-04, F-08 |
| My teams | Supervisor | Assigned teams with members; create-team form (`F-13`) | F-02, F-13 |
| Supervisor team detail | Supervisor | Member management (unassigned-student picker, add/remove member); milestone list with derived status badge; create-milestone form, optionally for several assigned teams at once | F-02, F-06, F-09, F-13 |
| Supervisor milestone detail | Supervisor | Versions with late badge; add feedback to a version; edit the milestone and extend its deadline; record, change and release the grade | F-03, F-04, F-05, F-08 |
| Revision history | All | Dedicated read-only revision history per milestone: version ordering (`desc`/`asc`), `Latest` badge, submitter/time, late status, and per-version feedback with author and time | F-07 |

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
| 400 | `BAD_REQUEST` | Request URL or body cannot be parsed (malformed JSON, primitive JSON body, undecodable compressed `gzip`/`deflate` stream, malformed URL percent-encoding) |
| 400 | `VALIDATION_ERROR` | Missing/invalid fields (`details` maps field → reason, including `INVALID_CHARACTER` for NUL/unpaired UTF-16 surrogates and `INVALID_DATE` for milestone years outside `1–9999`) |
| 401 | `UNAUTHENTICATED` | No, malformed, expired or revoked token |
| 401 | `INVALID_CREDENTIALS` | Login failed (same response for unknown e-mail and wrong password) |
| 403 | `FORBIDDEN` | The user's role may not call this operation |
| 404 | `NOT_FOUND` | Record does not exist **or** is outside the user's scope (no disclosure) |
| 409 | `VERSION_LIMIT_REACHED` | 4th submission for a milestone (BR-07) |
| 409 | `DEADLINE_NOT_EXTENDED` | Milestone edit with a deadline earlier than the stored one (BR-13) |
| 409 | `NOTHING_TO_GRADE` | Grade for a milestone with no submission (BR-11) |
| 409 | `GRADE_RELEASED` | Change or release after the milestone's grades were released (BR-11) |
| 409 | `NO_GRADE` | Release without a grade (BR-11) |
| 409 | `SUBMISSION_WINDOW_CLOSED` | Submission later than `deadline + 7 × 24 h` (BR-05, CHG-03); checked after `VERSION_LIMIT_REACHED` |
| 409 | `TEAM_NAME_EXISTS` | Creating a team whose trimmed name matches an existing team (case-insensitive) |
| 409 | `STUDENT_ALREADY_IN_TEAM` | Adding a student who already has a `TeamMembership` (BR-10) |
| 413 | `PAYLOAD_TOO_LARGE` | Request body exceeds server parser limit (100 kB) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Unsupported request charset or content encoding |
| 500 | `INTERNAL_ERROR` | Unexpected error; details only in server logs (NFR-05) |

**Pre-check (body parsing) & check order:** `express.json()` body parsing runs before authentication, so unreadable request bodies (malformed or primitive JSON, undecodable `gzip`/`deflate` streams raising `Z_DATA_ERROR`/`Z_BUF_ERROR`/`Z_NEED_DICT`, body `> 100 kB`, unsupported charset/encoding) fail fast with `400 BAD_REQUEST` (non-JSON stream errors use neutral `"Request body could not be read"`), `413 PAYLOAD_TOO_LARGE`, or `415 UNSUPPORTED_MEDIA_TYPE` even when no token is provided (chosen over delaying parser errors past auth because an unreadable payload cannot be parsed safely). Only specifically recognized Express/body-parser/zlib 4xx errors map to these responses; ORM/database errors are never blanket-mapped to `400`, so unexpected failures keep returning safe `500 INTERNAL_ERROR`.

**Shared text and date rules (F-01–F-06, F-13):**
- All validated text fields (login `email`/`password`, milestone `title`/`description`, submission `title`/`description`/`link`, feedback `comment`, team `name`) reject NUL (`U+0000`) and unpaired UTF-16 surrogates (lone high `0xD800–0xDBFF` or lone low `0xDC00–0xDFFF`) with `400 VALIDATION_ERROR` and `details.<field> = "INVALID_CHARACTER"` rather than silently stripping characters; valid surrogate pairs (e.g. emoji) are accepted. UI field maps render `INVALID_CHARACTER` as `"Contains an unsupported character"`, and login errors containing `INVALID_CHARACTER` report `"Email or password contains an unsupported character"`.
- A missing, non-JSON, or array body on `POST /api/auth/login` safely fails validation (`400 VALIDATION_ERROR`) instead of dereferencing `undefined`; a primitive JSON body, including `null`, is rejected by `express.json()` with `400 BAD_REQUEST`.
- Milestone `deadline` values on create (`F-02`, `F-06`) and edit (`F-05`) must parse to a UTC year in `1–9999`; out-of-range years (e.g. `+010000-01-01T00:00:00.000Z`) fail with `400 VALIDATION_ERROR` and `details.deadline = "INVALID_DATE"` (year `9999` stays accepted).

**Static-file error handling (`CLIENT_DIST_DIR`):** On non-`/api` paths when the built client is served (`express.static` / `res.sendFile`), exposed client HTTP `4xx` errors raised by `send` (`expose === true`, `400 ≤ status < 500`, including `416 Range Not Satisfiable` and `412 Precondition Failed`) preserve their `4xx` status and safe headers (such as `Content-Range` on `416`) with a short generic status text, rather than being converted to `500 INTERNAL_ERROR` or leaking filesystem paths or stack traces. Non-exposed filesystem errors (`expose !== true`) and API database errors continue falling through to `500 INTERNAL_ERROR`.

**Check order** for every protected request: body parsing (400/413/415) → authenticate (401 for missing/malformed/expired/revoked/deleted-user tokens; `500` logged if DB lookup fails) → URL parameter decoding (400 `BAD_REQUEST` on malformed `%zz`, before role checks) → role (403) → record scope (404) → field validation (400 `VALIDATION_ERROR`) → business rule (409). Scope is checked before field validation so that probing another team's records never reveals whether they exist.

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

### 4.2 Sprint 2 endpoints

| Method | Path | Role | Feature |
|---|---|---|---|
| PATCH | `/api/milestones/:milestoneId` | Supervisor, assigned (student 403) | F-05 |
| GET | `/api/milestones/:milestoneId/grade` | Any, in scope (student: no score before release) | F-08 |
| PUT | `/api/milestones/:milestoneId/grade` | Supervisor, assigned (student 403) | F-08 |
| POST | `/api/milestones/:milestoneId/grade/release` | Supervisor, assigned (student 403) | F-08 |
| POST | `/api/milestones` | Supervisor, assigned to every listed team (student 403; any unassigned/unknown team → 404, nothing stored) | F-06 |
| GET | `/api/milestones/:milestoneId/history` | Any, in scope (`?order=desc\|asc`, default `desc`; out-of-scope → 404) | F-07 |
| Milestone endpoints (list, detail, create, edit) | — | Every serialized `Milestone` includes server-derived `status` (BR-12, never stored) | F-09 |

### 4.3 Sprint 3 endpoints (contracts in `docs/sprints/sprint-3/`)

F-13 is implemented (#83). F-10, F-11 and F-12 are planned: read-only endpoints, no schema change; status comes from the F-09 helper with one `now` per request.

| Method | Path | Role | Feature | Screen |
|---|---|---|---|---|
| POST | `/api/teams` | Supervisor (student `403`; creator assigned automatically) | F-13 | `/supervisor` |
| GET | `/api/teams/available-students` | Supervisor (student `403`; unassigned students only) | F-13 | `/supervisor/teams/:teamId` |
| POST | `/api/teams/:teamId/members` | Supervisor, assigned (student `403`) | F-13 | `/supervisor/teams/:teamId` |
| DELETE | `/api/teams/:teamId/members/:studentId` | Supervisor, assigned (student `403`) | F-13 | `/supervisor/teams/:teamId` |
| GET | `/api/board` | Any, scoped (student: own team; supervisor: assigned teams) | F-10 (planned) | `/student/board`, `/supervisor/board` |
| GET | `/api/reports/summary` | Supervisor, assigned teams (student 403) | F-11 (planned) | `/supervisor/report` |
| GET | `/api/submissions?teamId=&milestoneId=&status=` | Supervisor, assigned teams (student 403; invalid filter 400 `INVALID_FILTER`; out-of-scope team/milestone 404) | F-12 (planned) | `/supervisor/submissions` |

## 5. Roles and permissions

"Own team" = the team the student belongs to. "Assigned" = a team the supervisor has a `SupervisorAssignment` for.
Out-of-scope reads return 404; operations the role may never perform return 403.

| Operation | Student | Supervisor | Sprint |
|---|---|---|---|
| Log in / log out / view own identity | ✅ | ✅ | 1 |
| View team, members, supervisors | Own team | Assigned teams | 1 |
| View milestones | Own team | Assigned teams | 1 |
| Create milestone | ❌ 403 | Assigned teams | 1 |
| Create the same milestone for several teams | ❌ 403 | Assigned teams only (all listed teams must be assigned) | 2 |
| Submit / resubmit work | Own team | ❌ 403 | 1 |
| View submissions and versions | Own team | Assigned teams | 1 |
| View milestone revision history | Own team | Assigned teams | 2 |
| Record feedback | ❌ 403 | Assigned teams | 1 |
| View feedback | Own team | Assigned teams | 1 |
| Edit / extend milestone | ❌ 403 | Assigned teams | 2 |
| Record / change / release grade | ❌ 403 | Assigned teams | 2 |
| View grade | Own team, after release | Assigned teams | 2 |
| Progress board | Own team | Assigned teams | 3 |
| Summary report, submission filters | ❌ 403 | Assigned teams | 3 |
| Manage teams and members | ❌ 403 | Create teams (assigned automatically); add/remove members on assigned teams (`F-13`, D-06) | 3 |

## 6. Authentication and session lifecycle

| Step | Design |
|---|---|
| Password storage | `bcryptjs` hash with cost 10 (NFR-01). Plain passwords exist only in the seed's input and in the login request body. |
| Login | `POST /api/auth/login { email, password }`. E-mail is lower-cased and looked up; the hash is compared with `bcrypt.compare` (unknown emails run a dummy cost-10 `bcrypt.compare` so timing matches known accounts). Missing fields or invalid characters (`U+0000`, unpaired UTF-16 surrogates) return `400 VALIDATION_ERROR`; malformed JSON stops before error logging (`400 BAD_REQUEST`) so passwords are never written to server logs; wrong e-mail or password returns `401 INVALID_CREDENTIALS` with the same message. Success returns `200 { token, user: { id, name, email, role } }`. |
| Token | JWT signed with HS256 using `JWT_SECRET`. Claims: `sub` (user id), `role`, `jti` (random UUID), `iat`, `exp`. Lifetime `JWT_EXPIRES_IN` = 2 h (NFR-04). |
| Client storage | The SPA keeps the token in `sessionStorage` (cleared when the tab closes) and sends it as a Bearer header. |
| Each request | `authenticate` verifies signature and expiry (`401` on JWT failure), rejects the token if its `jti` is in `RevokedToken` or the user was deleted (`401`), and sets `req.user = { id, role }`. Database or unexpected lookup errors pass via `next(err)` to `500 INTERNAL_ERROR` (logged on server, never `401`). |
| Current user | `GET /api/auth/me` returns `req.user`'s profile from the database. |
| Logout | `POST /api/auth/logout` inserts the token's `jti` and `exp` into `RevokedToken` idempotently (`skipDuplicates` / `ON CONFLICT DO NOTHING`) so concurrent logouts of one token return `204` (D-09); DB errors return `500` without revoking the token. The client deletes the stored token. Any later request with that token → 401. |
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
| `SEED_DEMO_PASSWORD` | server (seed only) | Password for synthetic demo accounts; **secret** on GCP | (local value; shared privately) |
| `NODE_ENV` | server | Runtime mode; `production` in the Docker image | `development` |
| `CLIENT_DIST_DIR` | server | Folder of the built client; when set, the API also serves the UI | `/app/client/dist` (image) |
| `TEST_DATABASE_URL` | server tests | Optional test database; name must end in `_test` | derived: `.../cpms_test` |
| `VITE_API_URL` | client (build time) | API base URL | `/api` |

The server refuses to start if `JWT_SECRET` or `DATABASE_URL` is missing, and the seed refuses to run without
`SEED_DEMO_PASSWORD` (no password in code). Tests use a separate database (`DATABASE_URL` pointing to `cpms_test`).
The full per-environment table (local, compose, CI, Cloud Run) is in `docs/labs/lab-05/deployment.md`.

## 8. Deployment plan (GCP)

Implemented in Lab 5 (issues #18–#22), following the course starter kit; operational details and the release
procedure are in `docs/labs/lab-05/deployment.md`. Changed from v0.4 by CHG-02 (start-up and approval rows).

```mermaid
flowchart LR
  GH["GitHub<br/>PR → CI build + tests<br/>(required check)"] -->|"reviewed merge to main"| AR["Artifact Registry<br/>image tagged with commit SHA"]
  AR --> JOB["Cloud Run job<br/>migrate deploy + seed"]
  JOB --> CR["Cloud Run service<br/>API + built SPA"]
  CR -->|"Cloud SQL connector"| SQL[("Cloud SQL<br/>PostgreSQL")]
  JOB --> SQL
  SM["Secret Manager<br/>DATABASE_URL, JWT_SECRET,<br/>SEED_DEMO_PASSWORD"] --> CR
  SM --> JOB
```

| Item | Design |
|---|---|
| Image | One multi-stage `Dockerfile`: build client (`vite build`); runtime runs the API with `tsx` and serves the built client from the same origin (`CLIENT_DIST_DIR`); non-root user; listens on `PORT` |
| Start-up | The container only starts the API. Migrations and the re-runnable seed run in a separate Cloud Run job (`cpms-migrate`) from the same image before the service is updated; a failed migration stops the release |
| Health | `GET /api/health` (process up) and `GET /api/ready` (database reachable, 503 otherwise) for the post-deploy smoke test |
| Database | Cloud SQL for PostgreSQL — durable across restarts and redeployments (NFR-08); migrations stay additive so an older image still runs after a rollback |
| Secrets | Secret Manager injected as environment variables; never in the image or Git |
| CI/CD | GitHub Actions: build + all automated tests on every PR into staging and `main` (required check `test-and-docker`, NFR-09); a merge into `main` (reviewed PR, passing check) builds the image, runs the migration job, deploys and smoke-tests. Rollback = re-run with an earlier commit SHA |
| Local parity | `docker-compose.yml`: `db`, `migrate` (runs once), `app` from the same image |

## 9. Test strategy

| Level | Tool | Scope | Location |
|---|---|---|---|
| Unit | Vitest | Pure rules: `daysLate`, URL/length validation, version selection | `server/tests/unit/` |
| API / integration | Vitest + Supertest + real PostgreSQL test DB | Endpoints, persistence, 401/403/404 access tests, concurrency (NFR-06) | `server/tests/api/` |
| UI component | Vitest + Testing Library | Forms, states, error display | `client/tests/` |
| End-to-end | Playwright | Critical journeys and one rejection journey (issue #6) | `e2e/` |

Integration tests reset the test database and reseed before each test file. Test IDs in each feature's STS map
to test names so results can be traced to acceptance criteria.

### 9.1 Defect `#90` (`DEF-BAD-INPUT`) regression tests

- **Unit (`server/tests/unit/invalid-input.test.ts`):** `TEST-90-U01` (NUL & unpaired UTF-16 surrogate helper + valid emoji pair), `TEST-90-U02` (F-02/F-03/F-04/F-05/F-13 text field rejection with `INVALID_CHARACTER`), `TEST-90-U03` (milestone `deadline` UTC year bounds `1–9999` → `INVALID_DATE` on create/edit).
- **API + DB (`server/tests/api/invalid-input.api.test.ts`):** `TEST-90-01` (positive controls), `TEST-90-02` (malformed JSON on login and milestone with/without token → `400 BAD_REQUEST`), `TEST-90-03` (primitive JSON `"text"` → `400 BAD_REQUEST`; non-JSON login body → `400 VALIDATION_ERROR`), `TEST-90-04` (malformed URL `%zz` without token → `401 UNAUTHENTICATED`; with token on `/teams/%zz`, `/milestones/%zz`, `/submissions/%zz` or as student on `POST /teams/%zz/milestones` → `400 BAD_REQUEST`), `TEST-90-05` (`> 100 kB` JSON body → `413 PAYLOAD_TOO_LARGE`), `TEST-90-06` (unsupported charset/encoding → `415 UNSUPPORTED_MEDIA_TYPE`), `TEST-90-07` (F-01 login NUL/unpaired surrogate → `400 VALIDATION_ERROR` with `"Email or password contains an unsupported character"`), `TEST-90-08` (F-02/F-05/F-06 milestone `title`/`description` NUL/surrogate → `400 VALIDATION_ERROR`, emoji → `201`), `TEST-90-09` (F-03 submission `title`/`description`/`link` NUL/surrogate → `400 VALIDATION_ERROR`), `TEST-90-10` (F-04 feedback `comment` NUL/surrogate → `400 VALIDATION_ERROR`), `TEST-90-11` (F-13 team `name` NUL/surrogate → `400 VALIDATION_ERROR`), `TEST-90-12` (milestone `deadline` year `≥ 10000` on F-02/F-06/F-05 → `400 VALIDATION_ERROR` `INVALID_DATE`, year `9999` accepted), `TEST-90-13` (unexpected non-HttpError failure still returns safe `500 INTERNAL_ERROR` with no internals), `TEST-90-14` (undecodable `gzip`/`deflate` stream body → `400 BAD_REQUEST` `"Request body could not be read"`, valid gzip → `200`/`201`).
- **UI (`client/tests/InvalidInputUi.test.tsx`):** `TEST-90-UI01` (login alert shows `"Email or password contains an unsupported character"`), `TEST-90-UI02..UI06` (`F-13` `/supervisor`, `F-02` `/supervisor/teams/1`, `F-05` `/supervisor/milestones/10`, `F-03` `/student/milestones/10`, `F-04` `/supervisor/milestones/10` show `"Contains an unsupported character"` for `INVALID_CHARACTER`, never the raw enum code).

### 9.2 Defect `#92` (`DEF-SERVER-ERR`) regression tests

- **Auth DB failure (`TEST-01-15`, `server/tests/api/auth.api.test.ts`):** Simulated DB outage / dropped connection in `authenticate` for `GET /api/auth/me`, `GET /api/teams`, and `POST /api/auth/logout` → `500 INTERNAL_ERROR` (logged via `console.error`), valid token recovers (`200`), and missing/malformed/expired/revoked tokens still return `401 UNAUTHENTICATED`.
- **Concurrent logout race (`TEST-01-16`, `server/tests/api/auth.api.test.ts`):** Parallel `POST /api/auth/logout` calls for one valid token return `204` across all requests and revoke the token (`401` thereafter).
- **Login timing balance (`TEST-01-17` / `TEST-01-17u`, `server/tests/api/auth.api.test.ts` & `server/tests/unit/auth-timing.test.ts`):** Unknown-email login executes cost-10 `bcrypt.compare`, keeping median latency comparable to known-email wrong password with identical `401 INVALID_CREDENTIALS`.
- **No password logging on malformed login (`TEST-01-18`, `server/tests/api/auth.api.test.ts`):** Malformed login JSON carrying a synthetic password returns `400 BAD_REQUEST` and never logs the password (regression guard already satisfied by `#91`).
- **Static-file 4xx errors (`TEST-92-01`, `server/tests/unit/static-errors.test.ts`):** `createApp({ clientDistDir })` preserves `416` (`Range: bytes=999999-`, with `Content-Range`), `412` (`If-Match: "x"` and past `If-Unmodified-Since`), alongside `200`/`206` positive controls and zero leaked paths/stack traces.
