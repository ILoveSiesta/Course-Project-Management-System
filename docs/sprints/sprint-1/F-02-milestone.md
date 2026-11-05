# F-02 Team View and Milestone Creation — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-02): contract`), then the failing
> tests (`test(F-02): ...`), then the implementation (`feat(F-02): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-05 | ILoveSiesta | Initial contract for F-02 (issue #3) |
| 0.2 | 2026-11-05 | ILoveSiesta | Definition of Done filled with executed results; no behaviour change |
| 0.3 | 2026-11-05 | ILoveSiesta | §3: screens use the shared stylesheet (CHG-01); no behaviour, text or test change |

## 1. Linked requirements

- **FR:** FR-05 (student views own team), FR-06 (supervisor lists assigned teams), FR-08 (create milestone), FR-09 (list milestones by deadline)
- **BR:** BR-01 (student scope: own team), BR-02 (supervisor scope: assigned teams), BR-03 (supervisor-only operation → 403 for students), BR-04 (milestone validation, future deadline)
- **NFR:** NFR-02 (401 on the new endpoints), NFR-03 (403/404 without data), NFR-05 (safe error shape), NFR-12 (UI shows the reason for a rejection)
- **Decisions:** D-04 (several supervisors per team), D-05 (one team per student), D-06 (teams come from seed data in Sprint 1)

## 2. Feature-level design

- **Behaviour and workflow**
  - A student opens **My team** (`/student`): sees their team's name, members and supervisors, and the team's milestones ordered by deadline (earliest first).
  - A supervisor opens **My teams** (`/supervisor`): sees every team they are assigned to, with members. Selecting a team opens **Team detail** (`/supervisor/teams/:teamId`): members, supervisors, milestones ordered by deadline and a **Create milestone** form.
  - Creating a milestone stores it for that team with the supervisor as `createdBy`; the list refreshes and shows it.
- **Business rules and validation (BR-04)**
  - `title`: required, trimmed, 1–120 characters.
  - `description`: optional; empty string is stored as `null`; at most 2000 characters.
  - `deadline`: required ISO 8601 date-time; must be **strictly later** than the server's current time at the moment of creation.
- **Access (BR-01..BR-03, SDS §4–§5)** — check order: authenticate (401) → role (403) → record scope (404) → validation (400).
  - Student: own team only. Supervisor: teams with a `SupervisorAssignment`.
  - Out-of-scope or non-existent team/milestone → `404 NOT_FOUND` (no disclosure). A non-numeric or non-positive ID is treated as not found.
  - `POST` milestone by a student → `403 FORBIDDEN` before any scope or validation check; nothing stored.
- **Failure and boundary cases**: unassigned supervisor creating → 404, nothing stored; invalid fields → 400 with per-field `details`, nothing stored; deadline equal to "now" → rejected; title of exactly 120 characters → accepted, 121 → rejected.
- **Dependencies**: F-01 (`authenticate`, `requireRole`, seeded teams/membership/assignments).
- **Test infrastructure (follow-up from the PR #8 review)**: server tests run against a separate database `cpms_test` derived from `DATABASE_URL` (or `TEST_DATABASE_URL` if set), reset with migrations before the run and seeded by the tests, as specified in SDS §9. The development database is no longer touched by tests.

## 3. UI specification

| Screen | Route | Content | States |
|---|---|---|---|
| My team | `/student` | Team name; members (name, e-mail); supervisors; milestone list (title, deadline, description) | Loading: "Loading…"; no team: "You are not assigned to a team yet."; no milestones: "No milestones yet."; error: message from API |
| My teams | `/supervisor` | One card per assigned team: name, members; link "Open team" | Loading; no teams: "You are not assigned to any team yet."; error |
| Team detail | `/supervisor/teams/:teamId` | Team name, members, supervisors; milestone list; Create milestone form (Title, Description, Deadline) | Loading; not found/not allowed: "Team not found or not allowed"; empty list; field errors under inputs; submit button disabled while saving |

- Deadlines are displayed in Asia/Bangkok time, e.g. `8 Nov 2026, 23:59 (ICT)` (A-04).
- The deadline input is `datetime-local`; its value is interpreted in the browser's time zone and sent as an ISO string in UTC.
- Field error texts: `REQUIRED` → "Required"; `TOO_LONG` → "Too long (max N characters)"; `INVALID_DATE` → "Invalid date"; `MUST_BE_FUTURE` → "Deadline must be in the future".
- A `401` from any F-02 call logs the user out (token cleared) and returns to `/login` (SDS §3.2).
- Students have no create form, and there is no student route to a supervisor screen. This is only for usability; the API enforces BR-03.
- Styling (CHG-01): all screens use the shared classes in `client/src/theme.css` (SDS §3.2): app header with brand, user name, role badge and Log out; content in cards; field errors shown in red under the input with a red border. The F-01 login and header move to the same style.

## 4. API specification

All responses use the JSON error shape from SDS §4. IDs are integers; timestamps are ISO 8601 UTC strings.

| Method | Path | Auth / role | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/api/teams` | Any | — | `200 { teams: Team[] }` — student: own team (0 or 1 item); supervisor: assigned teams ordered by name | 401 |
| GET | `/api/teams/:teamId` | Any, in scope | — | `200 { team: Team }` | 401, 404 |
| GET | `/api/teams/:teamId/milestones` | Any, in scope | — | `200 { milestones: Milestone[] }` ordered by `deadline` ascending, then `id` | 401, 404 |
| POST | `/api/teams/:teamId/milestones` | Supervisor, assigned | `{ title: string, description?: string \| null, deadline: string }` | `201 { milestone: Milestone }` | 401, 403, 404, 400 |
| GET | `/api/milestones/:milestoneId` | Any, in scope | — | `200 { milestone: Milestone }` | 401, 404 |

```ts
type Person = { id: number; name: string; email: string };
type Team = { id: number; name: string; members: Person[]; supervisors: Person[] };   // members/supervisors ordered by name
type Milestone = {
  id: number; teamId: number; title: string; description: string | null;
  deadline: string; createdAt: string; createdBy: { id: number; name: string };
};
```

Validation error example:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid milestone", "details": { "title": "REQUIRED", "deadline": "MUST_BE_FUTURE" } } }
```

`details` values: `REQUIRED`, `TOO_LONG`, `INVALID_DATE`, `MUST_BE_FUTURE`, `INVALID_TYPE`.

## 5. Data specification

New model `Milestone` with migration `f02_milestones`:

| Field | Type | Constraint |
|---|---|---|
| `id` | Int | PK, auto-increment |
| `teamId` | Int | FK → `Team.id`, `ON DELETE RESTRICT` |
| `title` | VARCHAR(120) | not null |
| `description` | VARCHAR(2000) | nullable |
| `deadline` | TIMESTAMPTZ(3) | not null |
| `createdById` | Int | FK → `User.id`, `ON DELETE RESTRICT` |
| `createdAt` | TIMESTAMPTZ(3) | default now() |

Index `(teamId, deadline)`. Back-relations: `Team.milestones`, `User.milestonesCreated`. No change to F-01 tables. The seed is unchanged (milestones are created through the feature).

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-02-01 | Given student1 (Team Alpha), when `GET /api/teams`, then exactly Team Alpha is returned with members student1, student2 and supervisor supervisor1. |
| AC-02-02 | Given supervisor1 (Alpha, Beta), when `GET /api/teams`, then Alpha and Beta are returned and Gamma is not. |
| AC-02-03 | Given a team outside the user's scope (student3 or supervisor2 → Alpha), when `GET /api/teams/:id`, then `404 NOT_FOUND` and no team data. In-scope user gets `200`. |
| AC-02-04 | Given no token, when any F-02 endpoint is called, then `401 UNAUTHENTICATED`. |
| AC-02-05 | Given supervisor1 and valid input, when `POST /api/teams/{Alpha}/milestones`, then `201` with the milestone, and it is stored with `teamId` = Alpha and `createdById` = supervisor1. |
| AC-02-06 | Given supervisor2 (not assigned to Alpha), when creating a milestone for Alpha, then `404 NOT_FOUND` and no milestone is stored. |
| AC-02-07 | Given student1, when `POST /api/teams/{Alpha}/milestones`, then `403 FORBIDDEN` and no milestone is stored. |
| AC-02-08 | Given invalid input (missing/blank/121-char title, 2001-char description, missing/invalid/past/now deadline), when creating, then `400 VALIDATION_ERROR` with per-field `details` and nothing is stored. A 120-char title and a deadline 1 s in the future are accepted. |
| AC-02-09 | Given milestones of a team, when an in-scope user lists them, then they are ordered by deadline ascending; an out-of-scope user gets 404. |
| AC-02-10 | Given a milestone, when `GET /api/milestones/:id`, then in-scope users get `200`; out-of-scope users, unknown IDs and non-numeric IDs get `404`. |
| AC-02-11 | Given a logged-in student, when `/student` loads, then the team, members, supervisors and milestones with deadlines in Asia/Bangkok time are shown; with no milestones the empty message is shown. |
| AC-02-12 | Given a supervisor on Team detail, when the form is submitted with valid data, then the new milestone appears in the list; when the API returns validation errors, each message is shown under its field. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-02-01 | AC-02-01 | API | Seeded; student1 token | `GET /api/teams` | 200; one team Alpha; members student1, student2; supervisors supervisor1 | `server/tests/api/teams-milestones.api.test.ts` › TEST-02-01 |
| TEST-02-02 | AC-02-02 | API | supervisor1 token | `GET /api/teams` | 200; Alpha and Beta only | same file › TEST-02-02 |
| TEST-02-03 | AC-02-03 | API | student3, supervisor2, student1 tokens | `GET /api/teams/{Alpha}` | 404 / 404 / 200; 404 body has no team | same file › TEST-02-03 |
| TEST-02-04 | AC-02-04 | API | No token | Call each of the 5 endpoints | 401 `UNAUTHENTICATED` for all | same file › TEST-02-04 |
| TEST-02-05 | AC-02-05 | API + DB | supervisor1 token | POST valid milestone to Alpha | 201; DB row with teamId Alpha, createdById supervisor1 | same file › TEST-02-05 |
| TEST-02-06 | AC-02-06 | API + DB | supervisor2 token | POST valid milestone to Alpha | 404; milestone count unchanged | same file › TEST-02-06 |
| TEST-02-07 | AC-02-07 | API + DB | student1 token | POST valid milestone to Alpha | 403; milestone count unchanged | same file › TEST-02-07 |
| TEST-02-08 | AC-02-08 | API + DB | supervisor1 token | POST each invalid body | 400 with expected `details`; count unchanged | same file › TEST-02-08 |
| TEST-02-09 | AC-02-09 | API | Milestones with deadlines +3 d, +1 d, +2 d on Alpha | List as student1; as student3 | Ascending order; student3 → 404 | same file › TEST-02-09 |
| TEST-02-10 | AC-02-10 | API | A milestone on Alpha | GET as student1, supervisor2, unknown ID, `abc` | 200 / 404 / 404 / 404 | same file › TEST-02-10 |
| TEST-02-11 | AC-02-08 | Unit | — | `validateMilestoneInput` boundaries | 120 ok / 121 TOO_LONG; blank REQUIRED; now MUST_BE_FUTURE; now+1 s ok; empty description → null | `server/tests/unit/milestone-validation.test.ts` |
| TEST-02-12 | AC-02-11 | UI | Mocked API: team + 2 milestones | Render `/student` | Team, members, supervisors, milestone titles and ICT deadlines shown | `client/tests/Milestones.test.tsx` › TEST-02-12 |
| TEST-02-13 | AC-02-11 | UI | Mocked API: team, no milestones | Render `/student` | "No milestones yet." | same file › TEST-02-13 |
| TEST-02-14 | AC-02-12 | UI | Mocked API | Fill form on `/supervisor/teams/1`, submit | POST body sent; new milestone listed | same file › TEST-02-14 |
| TEST-02-15 | AC-02-12 | UI | Mocked API returns 400 details | Submit form | "Required" / "Deadline must be in the future" under fields | same file › TEST-02-15 |

## 8. Definition of Done and evidence

- [x] All AC-02-01..AC-02-12 implemented
- [x] All STS tests executed and passing on a fresh database — `npm run build && npm test` on `b97f30d`: server 32 passed (F-02: 10 API + 6 unit), client 9 passed (F-02: 4), 0 failed, 0 skipped; E2E smoke 1/1
- [x] TDD red → green: failing tests `9de3700` (server 10 failed + unit file failed to load, client 4 failed) → implementation `b97f30d` (all pass)
- [x] `docs/traceability.md`, `docs/features.md`, sprint-1 README updated
- [ ] PR reviewed by phet526 and merged into `sprint-1`
