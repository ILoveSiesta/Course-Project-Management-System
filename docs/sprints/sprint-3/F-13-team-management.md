# F-13 Team Management — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-13): contract`), then the failing
> tests (`test(F-13): ...`), then the implementation (`feat(F-13): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-22 | phet526 | Initial contract for F-13 (issue #83): team creation, unassigned-student picker, member add/remove, BR-10 concurrency, BR-14 submitter preservation & removed-student access rules |
| 0.2 | 2026-11-22 | phet526 | Definition of Done filled with executed local & CI (`44932928877`) results; no behaviour change |
| 0.3 | 2026-11-22 | phet526 | Address PR #88 review: scope TEST-13-15 member-row assertions to `.member-info` and add `beforeEach`/`afterEach` `ensureStudentTwoInAlpha` cleanup (`f894aa6`, CI `44934740519`) |
| 0.4 | 2026-11-22 | phet526 | Clarify case-insensitive duplicate rule (`lower(name) = lower(:name)` under `pg_advisory_xact_lock`, avoiding `ILIKE` wildcards), INT4 upper bound (`> 2147483647` → `404`), and regression tests `TEST-13-16..18` |
| 0.5 | 2026-11-22 | phet526 | Definition of Done updated with RED (`a1632b9`) → GREEN (`dd2e5db`) results (`CI 45000265755`, `198 / 198` passed) and `docs/traceability.md` (`2.5`) reference |
| 0.6 | 2026-11-22 | phet526 | Add AC-13-12 / TEST-13-19 (`seed()` preserves member moves/removals across releases, `NFR-08`), link `NFR-08` in §1 & §5 |
| 0.7 | 2026-11-22 | phet526 | Update DoD with full `a1632b9` RED (`4 failed / 139 passed`), `e9a7854` RED (`1 failed / 143 passed`), and GREEN `b9d279d` (`45002978696`, `199 / 199` passed) evidence; sync SDS (`0.13`) and traceability (`2.6`) references |
| 0.8 | 2026-11-22 | phet526 | Add AC-13-13 / TEST-13-20 (`createSubmission` re-checks `TeamMembership` with `FOR SHARE` inside the milestone-locked transaction so a concurrent member removal rejects an in-flight submission with `404`) |

## 1. Linked requirements

- **FR:** FR-07 (a supervisor manages teams they supervise: create a team, add a student member, and remove a member)
- **BR:** BR-10 (a student belongs to at most one team; rejected with `409` if already assigned), BR-14 (removing or moving a member keeps `Submission.submittedById` unchanged on existing submissions; removed student loses access to the old team), BR-02 (supervisor scope: assigned teams only for member management), BR-03 (supervisor-only operations → `403` for students)
- **NFR:** NFR-02 (`401` on all new endpoints), NFR-03 (`403`/`404` without data disclosure), NFR-05 (safe JSON error shape), NFR-08 (member moves and removals survive re-execution of the release migration/seed job), NFR-12 (UI shows field and rule rejection reasons)
- **Decisions:** D-04 (teams can have multiple assigned supervisors; creating a team assigns the creator), D-05 (a student belongs to at most one team), D-06 (supervisors manage teams and membership from Sprint 3 onward)

## 2. Feature-level design

- **Behaviour and workflow**
  - **Create team:** On **Supervisor Dashboard** (`/supervisor`), any supervisor submits a new team name via **New team**. The backend creates the `Team` and an initial `SupervisorAssignment` for the creating supervisor inside one database transaction. The new team immediately appears in the supervisor's team list (`GET /api/teams`), accepts member additions/removals, and accepts milestones (F-02 / F-06).
  - **Student picker:** On **Supervisor team detail** (`/supervisor/teams/:teamId`), the add-member form loads unassigned students (`role = STUDENT` with no `TeamMembership`) from `GET /api/teams/available-students` so the UI never receives or exposes password hashes, supervisor accounts, or students currently belonging to other teams.
  - **Add member:** An assigned supervisor selects an unassigned student and clicks **Add member**. A `TeamMembership` row is created, the team card shows the updated sorted member list, and the student disappears from the available-student list.
  - **Remove member:** An assigned supervisor clicks **Remove** beside a member on `/supervisor/teams/:teamId`. Only that student's `TeamMembership` row is deleted. The team card removes them from the member list, and they become available again in `GET /api/teams/available-students`.
- **Business rules and validation**
  - **Team name validation:** `name` is required, must be a string, and after trimming must be 1–80 characters (`REQUIRED`, `INVALID_TYPE`, `TOO_LONG`). Duplicate team names are checked case-insensitively inside the creation transaction using exact `lower(name) = lower(:name)` matching (not `ILIKE`, so literal `_`, `%` and `\` remain valid team-name characters) serialized by `pg_advisory_xact_lock(hashtext(lower(:name)))`, backed by the case-sensitive `Team.name @unique` constraint (`P2002`); duplicates and concurrent case-variant races reject with **`409 TEAM_NAME_EXISTS`**, and nothing is stored.
  - **BR-10 (one team per student & concurrency):** Before creating a `TeamMembership`, the service verifies the student does not already have one; if they already belong to any team (this team or another), the request is rejected with **`409 STUDENT_ALREADY_IN_TEAM`** and nothing is stored. `TeamMembership.studentId` already carries a `@unique` constraint in `schema.prisma`, so concurrent add requests for the same student trigger PostgreSQL unique violation (`P2002`), which the service maps cleanly to **`409 STUDENT_ALREADY_IN_TEAM`** (at most one concurrent request succeeds with `201`).
  - **Target user rules on add:** `studentId` must be a positive integer (`400 VALIDATION_ERROR`: `REQUIRED` / `INVALID_TYPE`). Positive integers above PostgreSQL 32-bit `INT4` max (`2147483647`) have no matching record and return **`404 NOT_FOUND`** (`"Student not found"`), just like any other unknown user ID. If the user exists with `role !== "STUDENT"` (e.g. a supervisor account), the API returns **`400 VALIDATION_ERROR`** with `details: { studentId: "NOT_A_STUDENT" }` and nothing is stored.
  - **BR-14 (removing or moving a member):** Removing a member deletes only the `TeamMembership` row; `Submission`, `Feedback`, `Grade`, and `Milestone` records remain untouched (`submittedById` stays pointing to the original student).
    - The team (remaining members and assigned supervisors) keeps all existing milestones, submissions, revision history, feedback, and grades, still displaying the original submitter's name (`submittedBy`).
    - The removed student loses access immediately (`BR-01` scope uses `TeamMembership`): `GET /api/teams` returns `{ teams: [] }` (`Student Dashboard` displays `"You are not assigned to a team yet."`), and direct requests to the old team, its milestones, submissions, revision history, or grades return **`404 NOT_FOUND`**. For student writes (`POST /api/milestones/:milestoneId/submissions`), `createSubmission` also re-checks `TeamMembership` with `FOR SHARE` directly after acquiring the milestone row lock (`FOR UPDATE`), so a submission that was already in flight when the student was removed is rejected with **`404 NOT_FOUND`** and stores nothing, while a concurrent removal waits for any submission that already passed the `FOR SHARE` check.
- **Out of scope**
  - Deleting or renaming teams.
  - Assigning or removing other supervisors (`SupervisorAssignment` beyond adding the creating supervisor on team creation stays seed-managed per D-04/D-06).
  - Account registration, account deletion, or changing user roles.
  - A standalone "move student" operation or endpoint: moving a student between teams is explicitly **remove from current team, then add to target team** by a supervisor assigned to both teams (ensuring both BR-10 and BR-14 hold at every step).
- **Access and check order** (`SDS §4–§5`): authenticate (`401`) → role check (`403`) → team scope & integer ID checks (`404`) → body validation (`400`) → target user check (`404` unknown / `400` non-student) → business-rule conflict (`409`).
  - **Student:** `403 FORBIDDEN` on `POST /api/teams`, `GET /api/teams/available-students`, `POST /api/teams/:teamId/members`, and `DELETE /api/teams/:teamId/members/:studentId`.
  - **Unassigned supervisor / unknown IDs / non-numeric or out-of-range IDs:** `404 NOT_FOUND` with no team or membership disclosure (`parseId` rejects IDs `<= 0` or `> 2147483647` as `404`, and `DELETE` for a student who is not a member of that team also returns `404 NOT_FOUND`).
- **Dependencies:** F-01 (`User`, `Team`, `TeamMembership`, `SupervisorAssignment`, `authenticate`, `requireRole`), F-02 (`listTeams`, `getTeam`, `scopeFilter`, `TeamSummary`).

## 3. UI specification

| Screen | Route | Change | States |
|---|---|---|---|
| Supervisor Dashboard | `/supervisor` | New **New team** `.card` with **Team name** input (`#team-name`) and **Create team** button above the team list; creates a team and inserts it into **My teams** (sorted by name) | Saving: button disabled, `"Saving…"`; validation error: `"Required"` / `"Too long (max 80 characters)"` under **Team name**; duplicate (`409`): `.alert` `"A team with this name already exists"`; status confirmation `"Created <name>."`; `401` → logout |
| Supervisor team detail | `/supervisor/teams/:teamId` | Member rows inside the team summary card now show a **Remove** button beside each member; empty member list shows `"No members yet."`; new **Add member** form with `<select id="add-member-student" aria-label="Student">` populated from `GET /api/teams/available-students` and **Add member** button | Loading/empty picker: `"No unassigned students available"` and button disabled; removing: button `"Removing…"`; adding: button `"Adding…"`; success refreshes member list and picker with `role="status"` message; `409`/`400` renders API message in `.alert` above the member controls (`NFR-12`) |
| Student Dashboard | `/student` | Uses shared read-only `TeamSummary` (displays `"No members yet."` if a team has zero members, and `"You are not assigned to a team yet."` when a removed student has no team). No add/remove/create controls for students | — |

- Styling uses shared classes in `client/src/theme.css` (`card`, `form-field`, `has-error`, `field-error`, `btn`, `btn-secondary`, `btn-sm`, `member-row`, `inline-form`, `alert`, `empty-state`); no inline styles (CHG-01), usable without horizontal scroll at `375 px` and `1280 px` (NFR-11).

## 4. API specification

All endpoints require `Authorization: Bearer <token>` (`401 UNAUTHENTICATED` otherwise) and return the SDS §4 JSON error shape.

| Method | Path | Auth / role | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/teams` | Supervisor | `{ name: string }` (1–80 chars trimmed) | `201 { team: Team }` (`id`, `name`, `members: []`, `supervisors: [creator]`) | `401`, `403`, `400`, `409` (`TEAM_NAME_EXISTS`) |
| GET | `/api/teams/available-students` | Supervisor | — | `200 { students: Person[] }` (`id`, `name`, `email` of unassigned students only, ordered by `name`) | `401`, `403` |
| POST | `/api/teams/:teamId/members` | Supervisor, assigned | `{ studentId: number }` (positive integer) | `201 { team: Team }` (updated sorted `members` and `supervisors`) | `401`, `403`, `404`, `400`, `409` (`STUDENT_ALREADY_IN_TEAM`) |
| DELETE | `/api/teams/:teamId/members/:studentId` | Supervisor, assigned | — | `200 { team: Team }` (updated team after removing membership) | `401`, `403`, `404` |

Note on route registration: `GET /api/teams/available-students` is registered before `GET /api/teams/:teamId` in `server/src/routes/teams.routes.ts`.

Validation error examples (`400 VALIDATION_ERROR`):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid team", "details": { "name": "REQUIRED" } } }
```

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid team member", "details": { "studentId": "NOT_A_STUDENT" } } }
```

Rule conflict examples (`409`):

```json
{ "error": { "code": "TEAM_NAME_EXISTS", "message": "A team with this name already exists" } }
```

```json
{ "error": { "code": "STUDENT_ALREADY_IN_TEAM", "message": "Student already belongs to a team" } }
```

## 5. Data specification

No schema change and no Prisma migration: `Team` (`name @unique`), `TeamMembership` (`studentId @unique`), `SupervisorAssignment` (`@@unique([teamId, supervisorId])`), and `Submission.submittedById` (`ON DELETE RESTRICT`) already exist from F-01 and F-03.

Seed persistence (`NFR-08`): `server/prisma/seed.ts` creates the baseline teams first and creates each seeded student's baseline `TeamMembership` only inside that student's `user.upsert` `create` branch. When `seed` re-runs during deployments (`cpms-migrate`), existing accounts go through `update` without touching `TeamMembership`, so moved or removed memberships persist (`prisma migrate reset` restores the baseline demo layout).

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-13-01 | Given a logged-in supervisor, when they `POST /api/teams` with a valid name, then `201` creates the team and assigns them as supervisor; it appears in `GET /api/teams`, accepts member management and milestones (F-02/F-06), and rejects empty/non-string/>80-char names (`400`) or duplicate names case-insensitively (`409 TEAM_NAME_EXISTS`). |
| AC-13-02 | Given an unassigned student (e.g. a newly freed or unassigned `STUDENT`) and a supervisor assigned to a team, when the supervisor calls `GET /api/teams/available-students`, then `200` returns only unassigned students (`id`, `name`, `email`) without exposing students in teams, supervisors, or password hashes. |
| AC-13-03 | Given an unassigned student and an assigned supervisor, when the supervisor `POST /api/teams/:teamId/members` with `{ studentId }`, then `201` creates the `TeamMembership`, returns the updated `team`, the membership persists on `GET /api/teams/:teamId`, and the student leaves `/available-students`. |
| AC-13-04 | Given a student who already belongs to a team (same team or another team), when a supervisor attempts `POST /api/teams/:teamId/members` for that student, then `409 STUDENT_ALREADY_IN_TEAM` is returned and nothing changes (`BR-10`). When two requests concurrently try to add the same unassigned student to two teams, at most one gets `201` and the other gets `409`. |
| AC-13-05 | Given an invalid `studentId` (missing, non-integer, `<= 0`) or a `SUPERVISOR` user ID, when an assigned supervisor calls `POST /api/teams/:teamId/members`, then `400 VALIDATION_ERROR` (`REQUIRED` / `INVALID_TYPE` / `NOT_A_STUDENT`) is returned; when `studentId` does not exist in `User`, `404 NOT_FOUND` is returned. Nothing is stored. |
| AC-13-06 | Given a team member and an assigned supervisor, when the supervisor calls `DELETE /api/teams/:teamId/members/:studentId`, then `200` removes only `TeamMembership`, the member disappears from the team and reappears in `/available-students`, and attempting to remove a non-member returns `404 NOT_FOUND`. |
| AC-13-07 | Given a student who submitted work on Team A and is then removed (or moved to Team B via remove + add), when milestones/submissions/history of Team A are read afterwards, earlier submissions still display the original submitter (`BR-14`); meanwhile the removed student can no longer read Team A's records (`GET /api/teams` excludes Team A; direct reads return `404`) and can be added to another team (`BR-10`). |
| AC-13-08 | Given F-13 endpoints, when a student calls any of them → `403 FORBIDDEN`; when an unassigned supervisor calls add/remove member or uses an unknown/non-numeric ID → `404 NOT_FOUND`; without a valid token → `401 UNAUTHENTICATED`. Negative tests carry an authorized supervisor positive control. |
| AC-13-09 | Given **Supervisor Dashboard** (`/supervisor`), when the supervisor submits a valid new team name, the new team card appears in **My teams** and persists; when the API returns `400` or `409`, the validation or rule message is shown (`NFR-12`). |
| AC-13-10 | Given **Supervisor team detail** (`/supervisor/teams/:teamId`), when the supervisor selects an unassigned student and clicks **Add member**, the member appears in **Members** and leaves the picker; when they click **Remove** beside a member, the member leaves **Members** and returns to the picker; errors (`409`) show in `.alert`. |
| AC-13-11 | Given a browser user journey (E2E on real PostgreSQL), a supervisor creates a new team, opens it, removes a student who has an existing submission on an earlier team, adds that student to the new team, creates a milestone, verifies reload persistence, and confirms the earlier team's submission still shows the original submitter (`BR-14`). |
| AC-13-12 | Given existing seeded students whose memberships were moved (e.g. `student2` moved from Team Alpha to a new team) or removed (e.g. `student4` removed from Team Beta), when `seed()` / the release migration job re-runs, both changes survive: `student2` stays in the new team (still receiving `404` on Team Alpha milestones and `200` on the new team's milestone) and `student4` remains unassigned (`NFR-08`, `FR-07`, `BR-14`). |
| AC-13-13 | Given a student whose `POST /api/milestones/:milestoneId/submissions` is in flight waiting on the milestone lock when a supervisor removes them from that team (`DELETE /api/teams/:teamId/members/:studentId`), when the lock is released, the submission is rejected with `404 NOT_FOUND` and nothing is stored (`BR-01`, `BR-14`); under the same lock wait without removal (positive control), the submission succeeds with `201`. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-13-01 | AC-13-01 | API + DB | Seeded `supervisor1` token | `POST /api/teams` `{ name: "  Team Delta  " }`; then `GET /api/teams` & `POST /api/teams/:id/milestones` | `201` with creator in `supervisors`; team appears in `GET /api/teams` and accepts milestones | `server/tests/api/team-management.api.test.ts` › TEST-13-01 |
| TEST-13-02 | AC-13-01 | API + DB | `supervisor1` token | `POST /api/teams` with blank, non-string, 81-char name, `"Team Alpha"`, `"team alpha"` | `400 VALIDATION_ERROR` on invalid names; `409 TEAM_NAME_EXISTS` on duplicates (case-insensitive); nothing stored | same file › TEST-13-02 |
| TEST-13-03 | AC-13-02 | API + DB | One unassigned student created/freed, `supervisor2` token | `GET /api/teams/available-students` | `200` lists only unassigned student (`id`, `name`, `email`), excludes seeded assigned students, supervisors, and `passwordHash` | same file › TEST-13-03 |
| TEST-13-04 | AC-13-03 | API + DB | New team created by `supervisor1` + unassigned student | `POST /api/teams/:id/members`, then `GET /api/teams/:id` and `/available-students` | `201`, student persists in `team.members` and disappears from `/available-students` | same file › TEST-13-04 |
| TEST-13-05 | AC-13-04 | API + DB | `student1` already in Team Alpha | `supervisor2` tries adding `student1` to Team Gamma; `supervisor1` tries adding `student1` again to Team Alpha | Both `409 STUDENT_ALREADY_IN_TEAM`; DB memberships unchanged (`BR-10`) | same file › TEST-13-05 |
| TEST-13-06 | AC-13-04 | Integration | Unassigned student; `supervisor1` (Team A) & `supervisor2` (Team B) | `Promise.all` adding same student simultaneously to both teams | Exactly one `201` and one `409 STUDENT_ALREADY_IN_TEAM`; no `500`, student in exactly one team | same file › TEST-13-06 |
| TEST-13-07 | AC-13-05 | API + DB | `supervisor1`, Alpha team ID | `POST` missing `studentId`, non-int, `999999` (unknown), `supervisor2.id` (non-student) | `400` (`REQUIRED`/`INVALID_TYPE`), `404` unknown user, `400` (`NOT_A_STUDENT`); DB unchanged | same file › TEST-13-07 |
| TEST-13-08 | AC-13-06 | API + DB | Member in team, `supervisor1` | `DELETE /api/teams/:id/members/:studentId`; repeat `DELETE` | First returns `200`, removes membership, student returns to `/available-students`; second returns `404` | same file › TEST-13-08 |
| TEST-13-09 | AC-13-07 | API + DB | `student2` submits on Alpha milestone; `supervisor1` removes `student2` from Alpha and adds to new team | Read Alpha milestone submissions & history; check `student2` `GET /api/teams` & old Alpha endpoints | Original submission still has `submittedBy: Student Two` (`BR-14`); `student2` sees only new team and gets `404` on old Alpha milestone | same file › TEST-13-09 |
| TEST-13-10 | AC-13-08 | API + DB | Unauthenticated, `student1`, unassigned `supervisor2` vs Alpha, positive control `supervisor1` | Call all 4 F-13 endpoints per role + non-numeric `teamId` | No token `401`; student `403`; unassigned/bad ID `404`; `supervisor1` positive control succeeds | same file › TEST-13-10 |
| TEST-13-11 | AC-13-01, AC-13-05 | Unit | — | Boundary inputs for `validateTeamName` and `validateAddMemberInput` | 80 ok / 81 `TOO_LONG` / blank `REQUIRED` / non-string `INVALID_TYPE`; `studentId` positive int ok / missing/<=0/float errors | `server/tests/unit/team-management-validation.test.ts` |
| TEST-13-12 | AC-13-09 | UI | Mocked API: supervisor on `/supervisor` | Create team `"Team Delta"`; submit invalid/duplicate `"Team Alpha"` (`409`) | New team appears in **My teams**; `400` field error and `409` `.alert` displayed | `client/tests/TeamManagement.test.tsx` › TEST-13-12 |
| TEST-13-13 | AC-13-10 | UI | Mocked API: supervisor on `/supervisor/teams/1`, 1 available student | Add student via `<select>` + **Add member**; click **Remove** on member; test `409` error | Member list & picker update immediately; `409` displays `.alert` | same file › TEST-13-13 |
| TEST-13-14 | AC-13-09, AC-13-10 | UI | Mocked API: student on `/student` (with empty-member team & without team) | Render `/student` | Student sees read-only view (`"No members yet."` or `"You are not assigned to a team yet."`), zero management buttons | same file › TEST-13-14 |
| TEST-13-15 | AC-13-11 | E2E | Fresh seeded DB | Supervisor creates team, moves submitting student (remove from old + add to new), creates milestone, verifies reload + old submission `submittedBy` (`BR-14`) | Persists after page reload; old submission still attributes original submitter; moved student loses old team access | `e2e/f13-team-management.spec.ts` |
| TEST-13-16 | AC-13-01 | API + DB | `Team Alpha` seeded, `supervisor1` token | `POST /api/teams` with `Team_Alpha`, `Team%`, `%`, then `F13 Web\Api` followed by `f13 web\api` | `201` for each distinct name (`_`, `%`, `\` treated literally); second backslash variant rejected with `409 TEAM_NAME_EXISTS` | `server/tests/api/team-management.api.test.ts` › TEST-13-16 |
| TEST-13-17 | AC-13-01 | Integration | `supervisor1`, `supervisor2` tokens | Concurrent `Promise.all` `POST /api/teams` for case variants `"F13 Race Pair"` and `"f13 race pair"` | Exactly one `201` and one `409 TEAM_NAME_EXISTS`; DB stores one row | same file › TEST-13-17 |
| TEST-13-18 | AC-13-05, AC-13-06, AC-13-08 | API + Unit | `supervisor1`, Alpha team ID | `POST /teams/1/members` `{ studentId: 2147483648 }`, `DELETE /teams/1/members/2147483648`, `POST /teams/2147483648/members`; `parseId("2147483647")` / `parseId("2147483648")` | All three endpoints return `404 NOT_FOUND` (no `500`); `parseId` accepts `2147483647` and throws `404` on `2147483648` | same file › TEST-13-18; `server/tests/unit/team-management-validation.test.ts` |
| TEST-13-19 | AC-13-12 | API + DB | Seeded `student2` (Alpha) & `student4` (Beta), new team + milestones | Move `student2` Alpha → new team and remove `student4` from Beta; run `seed()` again | Both membership changes survive `seed()`; `student2` still gets `404` on Alpha milestone and `200` on new-team milestone; `student4` remains in `available-students` | same file › TEST-13-19 |
| TEST-13-20 | AC-13-13 | Integration | `student2` in Alpha, milestone locked via second Prisma client | Start `POST` submission while milestone is locked, remove `student2` (`200`), release lock; repeat without removal (positive control) | Removed case returns `404` and stores `0` rows; positive control without removal returns `201` and stores `1` row | same file › TEST-13-20 |

## 8. Definition of Done and evidence

- [x] All AC-13-01..AC-13-12 implemented
- [x] All STS tests executed and passing on a fresh test database — CI `CI & Docker Build` run `45002978696` on commit `b9d279d` (`199 / 199` passed, `0` failed, `0` skipped): `deploy/tests` `17` OK (+ deploy/release stub shell checks), backend `22` files / `144` passed (`team-management.api.test.ts` `14`, `team-management-validation.test.ts` `2`), frontend `11` files / `33` passed (`TeamManagement.test.tsx` `3`), Playwright E2E `5` passed in `14.6s` (no retries), and Docker image `cpms-app:ci` built cleanly; local checks (`npm run build`, `client` `33`, `server/tests/unit` `41`, `health.api.test.ts` `2`, `deploy/tests` `17`) also passed (`local Docker Desktop stopped`)
- [x] TDD red → green commits recorded on `feature/F-13-team-management`:
  - Initial feature (`26b20bc` contract → `eae26bf` RED `11 failed` API/unit & `3 failed` UI → `0f39b85` implementation → `2c7af88`/`a4dd669`/`f894aa6` E2E fixes, CI `44934740519`)
  - Round-2 fixes (`211a9f8` contract → `a1632b9` RED server `4 failed / 139 passed (143)`: `TEST-13-16` `expected 409 to be 201`, `TEST-13-17` `expected [ 201, 201 ] to deeply equal [ 201, 409 ]`, `TEST-13-18` API `expected 500 to be 404` & unit `expected undefined to be 404` → `dd2e5db` GREEN, CI `45000265755`, server `143/143`, `198/198` total)
  - Round-3 seed persistence (`ebeeb71` contract → `e9a7854` RED server `1 failed / 143 passed (144)` on CI `45002682158`: `TEST-13-19` `AssertionError: expected [ 1 ] to deeply equal [ 20 ]` → `b9d279d` GREEN, CI `45002978696`, server `144/144`, `199/199` total)
- [x] SRS FR-07 / BR-14 (`0.10`), System SDS §2.4 / §3.1 / §4 / §4.3 / §5 (`0.13`), `docs/traceability.md` (`2.6`), `docs/features.md` (`1.7`) updated
- [ ] PR `#88` reviewed by `@ILoveSiesta` (approve before merge) and merged into `sprint-3`
