# F-01 Authentication and Team Data — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-01): contract`), then the failing
> tests (`test(F-01): ...`), then the implementation (`feat(F-01): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-04 | phet526 | Initial contract for F-01 (Issue #2) |
| 0.2 | 2026-11-04 | phet526 | Implemented and verified against initial STS tests |
| 0.3 | 2026-11-04 | phet526 | Addressed PR review: env validation without fallback, test DB auto-seed, test role guard independently, added expired token & schema constraint tests, client routing via react-router-dom |
| 0.4 | 2026-11-21 | phet526 | Added `TEST-01-14` for `AC-01-10` (seed idempotency) and §8.1 follow-up checklist (#65) |
| 0.5 | 2026-11-22 | phet526 | Defect #90 (`DEF-BAD-INPUT`): reject NUL (`U+0000`) and unpaired UTF-16 surrogates in login `email`/`password` with `400 VALIDATION_ERROR` (`INVALID_CHARACTER`, `"Email or password contains an unsupported character"`), safely reject non-object JSON/non-JSON bodies (`400`), and link SDS §4 unreadable-request errors (`400`/`413`/`415`) |
| 0.6 | 2026-11-22 | phet526 | Address PR #91 round-3 review: distinguish missing/non-JSON/array login body (`400 VALIDATION_ERROR`) from primitive JSON body including `null` (`400 BAD_REQUEST`) |
| 0.7 | 2026-11-23 | phet526 | Defect #92 (`DEF-SERVER-ERR`): revise §2, §4, §6 (`AC-01-12..15`), and §7 (`TEST-01-15..18`) so `authenticate` forwards DB/unexpected errors to `500 INTERNAL_ERROR` (logging server-side), `logoutService` handles parallel requests for one `jti` idempotently (`204`), `loginService` runs dummy cost-10 `bcrypt.compare` for unknown emails, and malformed login JSON never logs raw request bodies/passwords |
| 0.8 | 2026-11-23 | phet526 | Record Defect #92 (`DEF-SERVER-ERR`) RED (`c310768`, CI `45052861149`) → GREEN (`d888ee7`, test spy fix `ef503c9`, CI `45053582959`, `235 / 235` passed) verification evidence in §8.2 |
| 0.9 | 2026-11-23 | phet526 | Address PR #99 review: revise §2, §6 (`AC-01-13`), and §7 (`TEST-01-16`) so concurrent HTTP `POST /api/auth/logout` requests for one token each return `204` or `401 UNAUTHENTICATED` (at least one `204`, never `500`), and add deterministic `logoutService` concurrency spec `TEST-01-16s` |
| 0.10 | 2026-11-23 | phet526 | Record clean pre-fix `9b05789 -- server/src` RED verification against `9eabab2` tests (local unit `3 failed`; CI `45108984909` server `7 failed / 165 passed (172)`) and 3 consecutive CI GREEN passes on `9eabab2` (`45108602555`, `45108892694`, `45109129623`, `236 / 236` passed) in §8.2 |
| 0.11 | 2026-11-23 | phet526 | Address PR #99 round-2 review: clarify in §8.2 that only `TEST-01-15u`, `TEST-01-17u`, and `TEST-92-01` failed for the defect on `c310768` while `TEST-01-15`'s delegate spy broke `TEST-01-16`/`TEST-01-17` (and failed on `d888ee7`), aligning §8.2 with `docs/traceability.md` `2.19` |
| 0.12 | 2026-11-23 | ILoveSiesta | Defect #94 group B (`DEF-CLIENT-SESSION`): §3 client session lifecycle — a 401 ends the session with a message on the login page; a failed session check (`/api/auth/me` not 401) keeps the token and offers **Try again**; a failed logout request keeps the user signed in with a message; a late session response is ignored; connection and non-JSON errors have fixed texts. AC-01-16..AC-01-20 and TEST-01-19..TEST-01-24 new; §8.3 added. Server behaviour unchanged. Written before the regression tests |

## 1. Linked requirements

- **FR:** FR-01 (Login), FR-02 (Current user /me), FR-03 (Logout revokes token), FR-04 (Role-based home)
- **BR:** BR-03 (Supervisor-only operations return 403 to students), BR-10 (A student belongs to at most one team)
- **NFR:** NFR-01 (bcrypt cost ≥ 10), NFR-02 (401 on protected endpoints), NFR-03 (backend role authorization 403), NFR-04 (Token expiry ≤ 2 h and logout revocation), NFR-05 (Safe error shape)
- **Decisions:** D-04 (Teams can have multiple supervisors), D-05 (Student in at most one team), D-09 (Token revocation on logout)

## 2. Feature-level design

- **Behavior and workflow:**
  - **Login:** A user provides email and password. The system verifies credentials using bcrypt hash comparison. If the email is not found, `loginService` runs a dummy cost-10 bcrypt comparison before returning `401 INVALID_CREDENTIALS` so response latency matches an existing account with a wrong password. On success, it issues a signed JWT token containing user identity and role, and returns the token with the user profile.
  - **Current user retrieval:** The client sends `Authorization: Bearer <token>`. The `authenticate` middleware verifies signature and expiration (`401` on JWT failure), checks whether the token's `jti` exists in `RevokedToken`, loads the user from the database (`401` if revoked or missing), and attaches `req.user = { id, role }`. Unexpected or database errors during the `RevokedToken` / `User` lookup are forwarded via `next(err)` to the safe `500 INTERNAL_ERROR` handler (logged on the server, never disguised as `401`).
  - **Logout:** A logged-in user sends `POST /api/auth/logout`. `logoutService(jti, exp)` records the token's `jti` and expiration timestamp into `RevokedToken` idempotently (`ON CONFLICT DO NOTHING` semantics across concurrent calls). When multiple concurrent `POST /api/auth/logout` requests arrive for the same token, each HTTP request returns `204 No Content` (or `401 UNAUTHENTICATED` if another concurrent request already committed the revocation before `authenticate` ran), at least one returns `204`, and none fail with `500`. Any subsequent request using this token is rejected with `401 UNAUTHENTICATED`. Database errors return `500 INTERNAL_ERROR` and leave the token unrevoked.
  - **Role Guard:** `requireRole(role)` middleware verifies `req.user.role`. If the role does not match the required role, it returns `403 FORBIDDEN` with no data.
- **Business rules and validation:**
  - Emails are normalized to lower-case and validated; a missing, non-JSON, or array body returns `400 VALIDATION_ERROR`, whereas a primitive JSON body (including `null`) is rejected by the parser with `400 BAD_REQUEST`.
  - Both `email` and `password` reject NUL (`U+0000`) and unpaired UTF-16 surrogates per SDS §4 (`400 VALIDATION_ERROR`, `details.<field> = "INVALID_CHARACTER"`, message `"Email or password contains an unsupported character"`, NFR-12). Unreadable HTTP bodies/charsets follow SDS §4 (`400 BAD_REQUEST`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`).
  - Password must be provided and verified against the stored bcrypt hash (or a precomputed cost-10 dummy hash when the email is unknown). Plaintext passwords are never stored, and body-parser/JSON syntax errors on login fail with `400 BAD_REQUEST` before server error logging so raw request bodies and passwords are never written to logs.
  - Error responses follow `{ error: { code, message, details? } }` with no leaked stack trace.
- **Failure and boundary cases:**
  - Non-existent email or incorrect password: returns identical `401 INVALID_CREDENTIALS` (prevents user enumeration).
  - Missing email or password: returns `400 VALIDATION_ERROR` (`"Email and password are required"`).
  - NUL or unpaired surrogate in email or password: returns `400 VALIDATION_ERROR` (`details.<field> = "INVALID_CHARACTER"`, `"Email or password contains an unsupported character"`, covered by `TEST-90-07`, `TEST-90-UI01`).
  - Malformed, expired, or revoked token: returns `401 UNAUTHENTICATED`.
  - Student attempting supervisor-only routes: returns `403 FORBIDDEN`.
- **Permissions:**
  - `POST /api/auth/login`: Public.
  - `POST /api/auth/logout`: Authenticated users (Student or Supervisor).
  - `GET /api/auth/me`: Authenticated users (Student or Supervisor).
- **Dependencies:**
  - Relies on PostgreSQL database and Prisma Client.
  - Seeds synthetic accounts for testing (Team Alpha, Beta, Gamma).

## 3. UI specification

- **Login Screen (`/login`):**
  - Form with email and password inputs.
  - Submit button with loading state during network request.
  - Error alert for invalid credentials or connection errors.
  - Successful login saves token to `sessionStorage` and redirects to `/student` or `/supervisor` based on role.
- **Role-based Home Routing:**
  - Implemented using `react-router-dom` with `ProtectedRoute` guards:
    - `/login`: Form for sign-in; redirects to role dashboard if already authenticated.
    - `/student`: Student Dashboard; redirects unauthenticated visitors to `/login` and supervisor users to `/supervisor`.
    - `/supervisor`: Supervisor Dashboard; redirects unauthenticated visitors to `/login` and student users to `/student`.
    - `*`: Catch-all redirect to role home (or `/login` if unauthenticated).
- **Navigation Header:**
  - Displays user name, role badge (`Student` / `Supervisor`), and "Log out" button.
  - Clicking "Log out" calls `POST /api/auth/logout`, clears `sessionStorage`, and redirects to `/login`.
- **Client session lifecycle (v0.12, #94 group B; SDS §3.2):**
  - **Session ended (B1):** a `401` from any API call (including `/api/auth/me` on page load) clears the token and the user, and `/login` shows the alert "Your session has ended. Please log in again.". The server already rejected the token, so no logout request is sent. The message is cleared by the next successful login and is not shown after a normal logout.
  - **Session check failed (B2):** if `/api/auth/me` fails for any other reason (network error, non-JSON body, `5xx`), the token is **kept**, the user is not sent to `/login`, and protected pages show the alert "Could not check your session. Check your connection and try again." with a **Try again** button that repeats the check.
  - **No second check after login:** the login response already contains the user, so login does not call `/api/auth/me`. A session response that arrives after the token changed or after logout is ignored (B4).
  - **Logout (B3):** `204` → signed out (unchanged). `401` → the token is already invalid on the server; signed out without a message. A network error or `5xx` → the user stays signed in, the token is kept, and the header shows the alert "Could not log out. Check your connection and try again."; pressing **Log out** again retries. Reason: FR-03/D-09 require the token to be revoked, and before v0.12 a failed request looked like a successful logout while the token stayed valid.
  - **Connection errors (B5):** for login and every other API call, a network failure is shown as "Cannot reach the server. Check your connection and try again." and a non-JSON error response as "The server is not available right now (HTTP <status>). Please try again later."; a JSON error keeps the API message (NFR-12). Raw texts such as `Failed to fetch`, `Request failed` or JSON parser messages are never shown.

## 4. API specification

| Method | Path | Auth / role | Request body | Success response | Error codes |
|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | None | `{ "email": string, "password": string }` | `200` `{ "token": string, "user": { "id": number, "name": string, "email": string, "role": string } }` | `400 VALIDATION_ERROR` (missing fields or `INVALID_CHARACTER`)<br/>`400 BAD_REQUEST` / `413` / `415` (SDS §4)<br/>`401 INVALID_CREDENTIALS` |
| `POST` | `/api/auth/logout` | Bearer token | None | `204 No Content` | `401 UNAUTHENTICATED`<br/>`500 INTERNAL_ERROR` (database failure; token unrevoked) |
| `GET` | `/api/auth/me` | Bearer token | None | `200` `{ "user": { "id": number, "name": string, "email": string, "role": string } }` | `401 UNAUTHENTICATED`<br/>`500 INTERNAL_ERROR` (database failure during auth lookup) |

## 5. Data specification

Models added to `server/prisma/schema.prisma` with migration `f01_auth_teams`:

- `Role` enum: `STUDENT`, `SUPERVISOR`
- `User`:
  - `id`: Int @id @default(autoincrement())
  - `email`: String @unique
  - `name`: String
  - `role`: Role
  - `passwordHash`: String
  - `createdAt`: DateTime @default(now())
- `RevokedToken`:
  - `jti`: String @id
  - `expiresAt`: DateTime
- `Team`:
  - `id`: Int @id @default(autoincrement())
  - `name`: String @unique
  - `createdAt`: DateTime @default(now())
- `TeamMembership`:
  - `id`: Int @id @default(autoincrement())
  - `teamId`: Int (FK -> Team)
  - `studentId`: Int @unique (FK -> User)
  - `createdAt`: DateTime @default(now())
- `SupervisorAssignment`:
  - `id`: Int @id @default(autoincrement())
  - `teamId`: Int (FK -> Team)
  - `supervisorId`: Int (FK -> User)
  - `createdAt`: DateTime @default(now())
  - `@@unique([teamId, supervisorId])`

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| **AC-01-01** | **Given** registered user credentials, **when** `POST /api/auth/login` is called, **then** return `200` with JWT token and user profile `{ id, name, email, role }`. |
| **AC-01-02** | **Given** wrong password or unknown email, **when** `POST /api/auth/login` is called, **then** return `401` with error code `INVALID_CREDENTIALS`. |
| **AC-01-03** | **Given** request missing email or password, **when** `POST /api/auth/login` is called, **then** return `400` with error code `VALIDATION_ERROR`. |
| **AC-01-04** | **Given** an authenticated user with valid token, **when** `GET /api/auth/me` is called, **then** return `200` with current user profile. |
| **AC-01-05** | **Given** missing, malformed, or expired token, **when** `GET /api/auth/me` is called, **then** return `401` with error code `UNAUTHENTICATED`. |
| **AC-01-06** | **Given** a valid token, **when** `POST /api/auth/logout` is called, **then** return `204` and revoke the token; subsequent requests with this token return `401 UNAUTHENTICATED`. |
| **AC-01-07** | **Given** a Student user, **when** accessing an endpoint guarded by `requireRole('SUPERVISOR')`, **then** return `403` with error code `FORBIDDEN`. |
| **AC-01-08** | **Given** user accounts created by seed or service, **when** inspected in the database, **then** `passwordHash` is a bcrypt hash with cost factor ≥ 10. |
| **AC-01-09** | **Given** database schema constraints, **then** duplicate email, duplicate team name, duplicate student team membership, or duplicate team-supervisor assignment are rejected by unique constraints. |
| **AC-01-10** | **Given** a fresh database, **when** seed script is executed, **then** Teams Alpha, Beta, Gamma with students and supervisors are created idempotently. |
| **AC-01-11** | **Given** client SPA, **when** user logs in, **then** route to respective role home (`/student` or `/supervisor`); logout clears token and returns to `/login`. |
| **AC-01-12** | **Given** a valid Bearer token when the database is unreachable or drops a connection during `authenticate`, **when** `GET /api/auth/me`, a protected route (`GET /api/teams`), or `POST /api/auth/logout` is called, **then** return `500 INTERNAL_ERROR` and log the failure on the server; missing, malformed, expired, or revoked tokens stay `401 UNAUTHENTICATED`, and a failed logout leaves the token usable once the database recovers. |
| **AC-01-13** | **Given** a valid Bearer token, **when** multiple concurrent `POST /api/auth/logout` requests arrive in parallel for that token, **then** each request returns `204` or `401 UNAUTHENTICATED` (at least one returns `204`, none return `500`), `logoutService` persists one `RevokedToken` row without error, and subsequent requests with that token return `401 UNAUTHENTICATED`. |
| **AC-01-14** | **Given** `POST /api/auth/login`, **when** called with an unknown email vs an existing email with a wrong password, **then** both run cost-10 `bcrypt.compare` work with comparable response latency and return identical `401 INVALID_CREDENTIALS`. |
| **AC-01-15** | **Given** `POST /api/auth/login` with malformed JSON (or unreadable request body) containing a password, **then** return `400 BAD_REQUEST` and never write the raw request body or password to server logs. |
| **AC-01-16** (v0.12, #94) | **Given** a signed-in user, **when** an API call answers `401` (or `/api/auth/me` answers `401` on page load), **then** the token is removed and `/login` shows "Your session has ended. Please log in again."; after a successful login the message is gone; a normal logout (`204`) shows no such message. |
| **AC-01-17** (v0.12, #94) | **Given** a stored token, **when** `/api/auth/me` fails with a network error or `500`/`503` on page load, **then** the token stays in `sessionStorage`, the user is not sent to `/login`, "Could not check your session. Check your connection and try again." is shown with **Try again**, and a successful retry shows the requested page. |
| **AC-01-18** (v0.12, #94) | **Given** a signed-in user, **when** **Log out** is pressed and `POST /api/auth/logout` fails with a network error or `500`, **then** the user stays signed in, the token is kept and the header shows "Could not log out. Check your connection and try again."; **when** it is pressed again and the server answers `204`, **then** the user is signed out; **when** the server answers `401`, **then** the user is signed out without an error. |
| **AC-01-19** (v0.12, #94) | **Given** a user who has just logged in, **when** they log out before any slow session response arrives, **then** they stay on `/login` with no user name in the header, also after that response would have arrived. |
| **AC-01-20** (v0.12, #94) | **Given** the login form or another form, **when** the request fails with a network error, **then** "Cannot reach the server. Check your connection and try again." is shown; **when** the server answers a non-JSON `503`, **then** "The server is not available right now (HTTP 503). Please try again later." is shown; no `Failed to fetch`, `Request failed` or JSON parser text appears. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / Input | Action | Expected result | File / Test Name |
|---|---|---|---|---|---|---|
| `TEST-01-01` | AC-01-01 | API | Seeded student credentials | `POST /api/auth/login` | Status 200, JWT token returned, role is STUDENT | `server/tests/api/auth.api.test.ts` › login with valid student credentials |
| `TEST-01-02` | AC-01-01 | API | Seeded supervisor credentials | `POST /api/auth/login` | Status 200, JWT token returned, role is SUPERVISOR | `server/tests/api/auth.api.test.ts` › login with valid supervisor credentials |
| `TEST-01-03` | AC-01-02 | API | Correct email, wrong password | `POST /api/auth/login` | Status 401, error code `INVALID_CREDENTIALS` | `server/tests/api/auth.api.test.ts` › login with incorrect password |
| `TEST-01-04` | AC-01-02 | API | Non-existent email | `POST /api/auth/login` | Status 401, error code `INVALID_CREDENTIALS` | `server/tests/api/auth.api.test.ts` › login with non-existent email |
| `TEST-01-05` | AC-01-03 | API | Missing email or password | `POST /api/auth/login` | Status 400, error code `VALIDATION_ERROR` | `server/tests/api/auth.api.test.ts` › login validation errors |
| `TEST-01-06` | AC-01-04 | API | Valid Bearer token | `GET /api/auth/me` | Status 200, user profile returned | `server/tests/api/auth.api.test.ts` › get current user profile |
| `TEST-01-07` | AC-01-05 | API | Missing Authorization header | `GET /api/auth/me` | Status 401, error code `UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` › unauthenticated request rejected |
| `TEST-01-08` | AC-01-05 | API | Malformed or invalid token | `GET /api/auth/me` | Status 401, error code `UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` › invalid token rejected |
| `TEST-01-08b`| AC-01-05 | API | Expired token | `GET /api/auth/me` | Status 401, error code `UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` › expired token rejected |
| `TEST-01-09` | AC-01-06 | API | Valid Bearer token | `POST /api/auth/logout`, then `GET /api/auth/me` | Logout returns 204; subsequent GET returns 401 `UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` › logout revokes token |
| `TEST-01-10` | AC-01-07 | API | Student token | Call route with `requireRole('SUPERVISOR')` | Status 403, error code `FORBIDDEN` | `server/tests/api/auth.api.test.ts` › role guard rejects student from supervisor route |
| `TEST-01-10b`| AC-01-07 | API | Supervisor token | Call route with `requireRole('SUPERVISOR')` | Status 200, status: ok | `server/tests/api/auth.api.test.ts` › role guard allows supervisor |
| `TEST-01-11` | AC-01-08 | Integration | Database seeded | Check stored password hashes for seeded users | 100% bcrypt hashes with cost ≥ 10 | `server/tests/api/auth.api.test.ts` › passwords are never stored in plaintext |
| `TEST-01-12` | AC-01-09 | Integration | Seeded database | Insert duplicate email, team name, student membership, supervisor assignment | Rejection by unique constraints | `server/tests/api/auth.api.test.ts` › unique constraints enforced |
| `TEST-01-14` | AC-01-10 | Integration | Test database with `SEED_DEMO_PASSWORD` set | Execute `seed()` twice consecutively and inspect users, teams, memberships, assignments, and login | Both runs succeed without error; counts and record IDs stay identical (`8` users, `3` teams, `6` memberships, `4` assignments, no duplicates); seeded login still succeeds | `server/tests/api/auth.api.test.ts` › TEST-01-14 |
| `TEST-01-13` | AC-01-11 | UI | Client rendered at /login | Fill student credentials and submit | Redirects to /student, renders dashboard & user info | `client/tests/Auth.test.tsx` › student login & redirect |
| `TEST-01-13b`| AC-01-11 | UI | Client rendered at /login | Fill supervisor credentials and submit | Redirects to /supervisor, renders dashboard | `client/tests/Auth.test.tsx` › supervisor login & redirect |
| `TEST-01-13c`| AC-01-11 | UI | Client authenticated | Click "Log out" button | Clears session token, redirects to /login | `client/tests/Auth.test.tsx` › logout clears session |
| `TEST-01-15` | AC-01-12 | Unit + API | Valid token; DB failure / dropped-connection rejection in `authenticate`, then recovery; plus missing/malformed/expired/revoked controls | Call `GET /api/auth/me`, `GET /api/teams`, and `POST /api/auth/logout` during failure, then `GET /api/auth/me` after recovery | Returns `500 INTERNAL_ERROR` (logged via `console.error`) during outage; valid token succeeds (`200`) on recovery; invalid/expired/revoked controls return `401 UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` › TEST-01-15 |
| `TEST-01-16` | AC-01-13 | API + DB | Valid student Bearer token on real PostgreSQL (10 rounds) | Send 5 concurrent `POST /api/auth/logout` requests via `Promise.all`, then `GET /api/auth/me` | Each round returns only `204` or `401 UNAUTHENTICATED` (none `500`), at least one returns `204`, and subsequent `GET /api/auth/me` returns `401 UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` › TEST-01-16 |
| `TEST-01-16s` | AC-01-13 | Service + DB | Fresh random `jti` per round on real PostgreSQL (10 rounds) | Call 10 concurrent `logoutService(jti, exp)` invocations via `Promise.allSettled` | `0` rejected calls across all 100 invocations and `revokedToken.count({ where: { jti } }) === 1` in every round | `server/tests/api/auth.api.test.ts` › TEST-01-16s |
| `TEST-01-17` | AC-01-14 | Unit + API | Unknown email vs seeded email with wrong password | Run repeated `POST /api/auth/login` rounds (and unit spy verification on `bcrypt.compare`) | Both return identical `401 INVALID_CREDENTIALS`; `bcrypt.compare` executes on unknown email and median latency is comparable to known-email wrong password | `server/tests/api/auth.api.test.ts` › TEST-01-17; `server/tests/unit/auth-timing.test.ts` › TEST-01-17u |
| `TEST-01-18` | AC-01-15 | API | Malformed JSON body carrying a synthetic password marker on `POST /api/auth/login` | Spy on `console.error`, `console.warn`, and `console.log` while sending malformed JSON | Returns `400 BAD_REQUEST` and no console call includes the synthetic password marker (regression guard already satisfied by `#91`) | `server/tests/api/auth.api.test.ts` › TEST-01-18 |
| `TEST-01-19` | AC-01-16 | UI | Mocked API: stored token, `/api/auth/me` 200 then `GET /api/teams` 401; second case: `/api/auth/me` 401 on load | Render `/student`; then log in again | Login page with the session-ended alert and no token; after login the alert is gone; `POST /api/auth/logout` not called for the 401 | `client/tests/ClientSession.test.tsx` › TEST-01-19 |
| `TEST-01-20` | AC-01-17 | UI | Mocked API: stored token, `/api/auth/me` rejects (network), then answers 500, then 200 | Render `/student`, press **Try again** twice | Token kept, session-check alert with **Try again**, no login form; after the 200 the dashboard is shown | same file › TEST-01-20 |
| `TEST-01-21` | AC-01-18 | UI | Mocked API: signed in; `POST /api/auth/logout` rejects (network), then 500, then 204; second case: 401 | Press **Log out** each time | Header alert and token kept after network and 500; signed out after 204; with 401 signed out without any alert | same file › TEST-01-21 |
| `TEST-01-22` | AC-01-19 | UI | Mocked API: login 200; any `/api/auth/me` answered after 300 ms; logout 204 | Log in, press **Log out** at once, wait 600 ms | Still on `/login`; no user name or **Log out** button; no token | same file › TEST-01-22 |
| `TEST-01-23` | AC-01-20 | UI | Mocked API: login rejects (network); then login answers 503 with an HTML body | Submit the login form twice | Connection text, then the HTTP 503 text; no `Failed to fetch` or JSON parser text | same file › TEST-01-23 |
| `TEST-01-24` | AC-01-20 | UI | Mocked API: supervisor on `/supervisor/teams/1`; create-milestone POST rejects (network), then answers 503 with an HTML body | Submit a valid New milestone form twice | Connection text, then the HTTP 503 text in the form alert; no `Failed to fetch` or `Request failed` | same file › TEST-01-24 |

## 8. Definition of Done and evidence

- [x] All AC implemented
- [x] All STS tests executed and passing (command: `npm run build && npm test`, counts: 16 server passed, 5 client passed, 0 failed)
- [x] TDD red → green evidence for rule work (failing commit: `020907e`, passing commit: `3bf1b61`, review fix commit: `d24f2c0`)
- [ ] PR reviewed by teammate and merged into sprint staging (PR #8)
- [x] Docs updated

### 8.1 Follow-up verification — AC-01-10 (#65)

- [x] STS test ID `TEST-01-14` added for `AC-01-10` in §7
- [x] Automated integration test `TEST-01-14` added in `server/tests/api/auth.api.test.ts` (seed already uses idempotent upserts; no `seed.ts` change required)
- [x] Executed against PostgreSQL on `bbda76d`: `npm run build` OK, `npm test` (server **102 passed** across 12 files including `TEST-01-14`, client **21 passed** across 6 files), `npm run test:e2e` (**4 passed**), `python -m unittest discover -s deploy/tests` (**17 OK**); 0 failed, 0 skipped
- [ ] PR reviewed and merged into `sprint-2`

### 8.2 Defect `#92` (`DEF-SERVER-ERR`) verification

- [x] Owner triage posted on `#92` (`issuecomment-7083244946`); `F-01` (`0.7`–`0.11`), `SDS` (`0.19`–`0.20`), and `docs/traceability.md` (`2.18`–`2.20`) updated
- [x] Initial TDD RED → GREEN on `fix/auth-and-error-status`:
  - Contract (`2b6edd3`) → initial RED (`c310768`, CI `45052861149` `6 failed | 165 passed (171)`; only `TEST-01-15u`, `TEST-01-17u`, and `TEST-92-01` failed for the defect, while `TEST-01-15`'s delegate spy broke `TEST-01-16`/`TEST-01-17` and also failed on GREEN `d888ee7` CI `45053202752`, so the valid RED for those API tests is the pre-fix re-run below) → runtime fix (`d888ee7`) + `getPrisma` spy fix (`ef503c9`, CI `45053582959`, `235 / 235` passed)
- [x] PR #99 round-1 review verification (`f127555` → `9eabab2`):
  - **Pre-fix RED check of final `9eabab2` tests against `9b05789 -- server/src`:**
    - Local (`git checkout 9b05789 -- server/src; npx --prefix server vitest run tests/unit/auth-timing.test.ts tests/unit/static-errors.test.ts`): `3 failed` (`TEST-01-15u` expected `401` to be `500`, `TEST-01-17u` `compare` called `0` times, `TEST-92-01` expected `500` to be `416`)
    - PostgreSQL CI (`45108984909`, dispatched from temporary check commit `cbe098e` before deleting branch): server `3 failed | 23 passed (26)` files, `7 failed | 165 passed (172)` tests — `TEST-01-15` (`401` vs `500`), `TEST-01-16` (`500` vs `[204, 401]`), `TEST-01-16s` (`4` rejected `logoutService` calls vs `0`), `TEST-01-17` (`2.40 ms` vs `>= 24.71 ms`), `TEST-01-15u` (`401` vs `500`), `TEST-01-17u` (`0` vs `1`), `TEST-92-01` (`500` vs `416`), with `TEST-01-18` passing immediately confirming `#91` log safety
  - **GREEN (`9eabab2`):** local `npm --prefix server run build` OK, `npm --prefix client run build` OK, `npm --prefix client test -- --run` `42 / 42`, `tests/unit` + `health.api.test.ts` `49 / 49`, `deploy/tests` `17 / 17`; 3 consecutive CI passes (`45108602555` in `2m32s`, `45108892694`, `45109129623` in `2m13s`): `236 / 236` passed (`deploy/tests` `17`, server `26` files / `172` passed including `20` in `auth.api.test.ts`, client `12` files / `42` passed, Playwright E2E `5` passed in `15.6s`, Docker build OK)
- [ ] PR #99 reviewed by `@ILoveSiesta` and merged into `sprint-3`

### 8.3 Defect #94 group B (`DEF-CLIENT-SESSION`, v0.12)

- [ ] Contract v0.12 committed before the tests
- [ ] RED: TEST-01-19..TEST-01-24 and F-13 TEST-13-21 fail on the pre-fix code for the reported behaviour
- [ ] GREEN: the same tests pass; full regression passes; `GradeCard.tsx` unchanged
- [ ] PR reviewed by phet526 (approve before merge) and merged into `sprint-3`
