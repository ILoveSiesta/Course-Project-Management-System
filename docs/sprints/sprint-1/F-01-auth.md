# F-01 Authentication and Team Data — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-01): contract`), then the failing
> tests (`test(F-01): ...`), then the implementation (`feat(F-01): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-04 | phet526 | Initial contract for F-01 (Issue #2) |

## 1. Linked requirements

- **FR:** FR-01 (Login), FR-02 (Current user /me), FR-03 (Logout revokes token), FR-04 (Role-based home)
- **BR:** BR-03 (Supervisor-only operations return 403 to students), BR-10 (A student belongs to at most one team)
- **NFR:** NFR-01 (bcrypt cost ≥ 10), NFR-02 (401 on protected endpoints), NFR-03 (backend role authorization 403), NFR-04 (Token expiry ≤ 2 h and logout revocation), NFR-05 (Safe error shape)
- **Decisions:** D-04 (Teams can have multiple supervisors), D-05 (Student in at most one team), D-09 (Token revocation on logout)

## 2. Feature-level design

- **Behavior and workflow:**
  - **Login:** A user provides email and password. The system verifies credentials using bcrypt hash comparison. On success, it issues a signed JWT token containing user identity and role, and returns the token with the user profile.
  - **Current user retrieval:** The client sends `Authorization: Bearer <token>`. The `authenticate` middleware verifies signature and expiration, checks whether the token's `jti` exists in `RevokedToken`, loads the user from the database, and attaches `req.user = { id, role }`.
  - **Logout:** A logged-in user sends `POST /api/auth/logout`. The system records the token's `jti` and expiration timestamp into `RevokedToken` and returns `204 No Content`. Any subsequent request using this token is rejected with `401 UNAUTHENTICATED`.
  - **Role Guard:** `requireRole(role)` middleware verifies `req.user.role`. If the role does not match the required role, it returns `403 FORBIDDEN` with no data.
- **Business rules and validation:**
  - Emails are normalized to lower-case and validated.
  - Password must be provided and verified against the stored bcrypt hash. Plaintext passwords are never stored.
  - Error responses follow `{ error: { code, message, details? } }` with no leaked stack trace.
- **Failure and boundary cases:**
  - Non-existent email or incorrect password: returns identical `401 INVALID_CREDENTIALS` (prevents user enumeration).
  - Missing email or password: returns `400 VALIDATION_ERROR`.
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
  - Student logged in: `/student` (shows Student Home, current user name, role, and logout button).
  - Supervisor logged in: `/supervisor` (shows Supervisor Home, current user name, role, and logout button).
  - Unauthenticated access to `/student` or `/supervisor` redirects to `/login`.
  - Cross-role navigation (e.g. Student accessing `/supervisor`) redirects to the user's home screen.
- **Navigation Header:**
  - Displays user name, role badge (`Student` / `Supervisor`), and "Log out" button.
  - Clicking "Log out" calls `POST /api/auth/logout`, clears `sessionStorage`, and redirects to `/login`.

## 4. API specification

| Method | Path | Auth / role | Request body | Success response | Error codes |
|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | None | `{ "email": string, "password": string }` | `200` `{ "token": string, "user": { "id": number, "name": string, "email": string, "role": string } }` | `400 VALIDATION_ERROR`<br/>`401 INVALID_CREDENTIALS` |
| `POST` | `/api/auth/logout` | Bearer token | None | `204 No Content` | `401 UNAUTHENTICATED` |
| `GET` | `/api/auth/me` | Bearer token | None | `200` `{ "user": { "id": number, "name": string, "email": string, "role": string } }` | `401 UNAUTHENTICATED` |

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
| `TEST-01-09` | AC-01-06 | API | Valid Bearer token | `POST /api/auth/logout`, then `GET /api/auth/me` | Logout returns 204; subsequent GET returns 401 `UNAUTHENTICATED` | `server/tests/api/auth.api.test.ts` › logout revokes token |
| `TEST-01-10` | AC-01-07 | API | Student token | Call route with `requireRole('SUPERVISOR')` | Status 403, error code `FORBIDDEN` | `server/tests/api/auth.api.test.ts` › role guard rejects student from supervisor route |
| `TEST-01-11` | AC-01-08 | Integration | Database seeded | Check stored password hashes for seeded users | 100% bcrypt hashes with cost ≥ 10 | `server/tests/api/auth.api.test.ts` › passwords are never stored in plaintext |
| `TEST-01-12` | AC-01-09 | Integration | Seeded database | Insert duplicate user email or student membership | Rejection by unique constraint | `server/tests/api/auth.api.test.ts` › unique constraints enforced |
| `TEST-01-13` | AC-01-11 | UI | Client rendered | Fill login form and submit | Redirects to role home; logout redirects to login | `client/tests/Auth.test.tsx` › login and logout flow |

## 8. Definition of Done and evidence

- [ ] All AC implemented
- [ ] All STS tests executed and passing (command, commit, counts recorded)
- [ ] TDD red → green evidence for rule work (commits recorded)
- [ ] PR reviewed by teammate and merged into sprint staging (PR #)
- [ ] Docs and traceability updated
