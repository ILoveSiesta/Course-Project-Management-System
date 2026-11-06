# F-03 Submission and Versions — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-03): contract`), then the failing
> tests (`test(F-03): ...`), then the implementation (`feat(F-03): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | phet526 | Initial contract for F-03 (issue #4) |

## 1. Linked requirements

- **FR:** FR-12 (student submits milestone work), FR-13 (view submissions, late flag and days late), FR-14 (resubmit as new version, earlier versions kept)
- **BR:** BR-01 (student scope: own team), BR-02 (supervisor scope: assigned teams), BR-03 (student-only operation: supervisor POST → 403), BR-05 (late flag and days late calculation), BR-06 (sequential unique versions, concurrency-safe), BR-07 (max 3 versions per team-milestone, 4th rejected), BR-08 (submission validation)
- **NFR:** NFR-02 (401 on protected endpoints), NFR-03 (403/404 without data disclosure), NFR-05 (safe error shape), NFR-06 (concurrent submissions integrity), NFR-12 (understandable rejections)
- **Decisions:** D-01 (late submissions accepted and marked), D-02 (up to 3 versions), D-07 (title, optional description, link)
- **Assumptions:** A-03 (external link format validated), A-04 (server clock authoritative for daysLate)

## 2. Feature-level design

- **Behaviour and workflow**
  - A student opens a milestone from **My team** (`/student/milestones/:milestoneId`): sees the milestone title, deadline, description, team name; the list of previously submitted versions with their version number, submitter, submission date, external link and late status badge; and a **Submit work** (or **Resubmit work**) form.
  - A supervisor opens a milestone from **Supervisor team detail** (`/supervisor/milestones/:milestoneId`): sees the milestone details and the list of submitted versions with submitter name, timestamp, link and late status badge. Supervisors cannot submit work.
  - Submitting work creates a new version with `version = previous version + 1` (starting at 1). Earlier versions are immutable (never overwritten or updated).
- **Business rules and validation**
  - **BR-05 (Days late):**
    - Submissions are accepted after the deadline (D-01).
    - `daysLate = Math.ceil((submittedAt.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000))` using server time.
    - If `submittedAt <= deadline`, `daysLate = 0` (on time).
    - If `submittedAt > deadline`, `daysLate >= 1` (even 1 second late counts as 1 day late).
  - **BR-06 & BR-07 (Version limit and concurrency):**
    - Each milestone allows at most 3 versions (D-02).
    - When `count >= 3`, submitting throws `409 VERSION_LIMIT_REACHED` with message "Maximum of 3 versions reached for this milestone".
    - Concurrency safety (NFR-06): creation runs inside a database transaction (`prisma.$transaction`) with a row lock (`FOR UPDATE` on `Milestone`) and a database unique constraint `@@unique([milestoneId, version])` preventing race conditions or duplicate version numbers.
  - **BR-08 (Field validation):**
    - `title`: required, trimmed, 1–120 characters (`REQUIRED`, `TOO_LONG`).
    - `description`: optional; empty string is stored as `null`; at most 2000 characters (`TOO_LONG`, `INVALID_TYPE`).
    - `link`: required, valid absolute `http` or `https` URL, at most 2048 characters (`REQUIRED`, `TOO_LONG`, `INVALID_URL`, `INVALID_TYPE`).
- **Access and check order (SDS §4–§5):**
  - Check order: authenticate (401) → role (403) → record scope (404) → validation (400) → business rule (409).
  - Student: may view submissions and submit work only for milestones belonging to their own team (`memberships: { some: { studentId: user.id } }`).
  - Supervisor: may view submissions only for milestones belonging to assigned teams (`supervisorAssignments: { some: { supervisorId: user.id } }`). Calling `POST /api/milestones/:id/submissions` returns `403 FORBIDDEN` immediately.
  - Out-of-scope or non-existent milestone/submission → `404 NOT_FOUND` (no data disclosure). Non-numeric or non-positive IDs yield 404.

## 3. UI specification

| Screen | Route | Content | States |
|---|---|---|---|
| Student milestone detail | `/student/milestones/:milestoneId` | Back to My team link; milestone title, deadline (ICT), description; submission versions list; submit/resubmit form | Loading; not found/not allowed; empty submissions ("No submissions yet"); field errors under inputs; disabled submit button while saving; version limit reached notice ("Maximum of 3 versions reached") |
| Supervisor milestone detail | `/supervisor/milestones/:milestoneId` | Back to team link; milestone title, deadline (ICT), description; submission versions list with submitter name, link, late badge | Loading; not found/not allowed; empty submissions ("No submissions yet") |

- Deadlines and submission times are formatted in Asia/Bangkok time, e.g. `8 Nov 2026, 23:59 (ICT)` (A-04).
- Submission versions display:
  - Header: `Version N`
  - Badge: `.badge.badge-success` "On time" if `daysLate === 0`; `.badge.badge-warning` `Late (+N d)` if `daysLate > 0`.
  - Submitter: `Submitted by: <name>` at `<formatted date>`
  - Link: `<a href={link} target="_blank" rel="noreferrer">`
  - Description: if present.
- When 3 versions exist: the submission form is replaced by a clear notice: "Maximum of 3 versions reached for this milestone."
- Styling: reuses classes from `client/src/theme.css` (`card`, `badge`, `badge-success`, `badge-warning`, `btn`, `btn-secondary`, `form-field`, `has-error`, `field-error`, `alert`, `empty-state`).

## 4. API specification

All responses follow the JSON error shape from SDS §4. IDs are integers; timestamps are ISO 8601 UTC strings.

| Method | Path | Auth / role | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/api/milestones/:milestoneId/submissions` | Any, in scope | — | `200 { submissions: Submission[] }` ordered by `version` ascending | 401, 404 |
| POST | `/api/milestones/:milestoneId/submissions` | Student, own team | `{ title: string, description?: string \| null, link: string }` | `201 { submission: Submission }` | 401, 403, 404, 400, 409 |
| GET | `/api/submissions/:submissionId` | Any, in scope | — | `200 { submission: Submission }` | 401, 404 |

```ts
type Submission = {
  id: number;
  milestoneId: number;
  version: number;
  title: string;
  description: string | null;
  link: string;
  submittedAt: string; // ISO 8601 UTC
  daysLate: number;
  submittedBy: { id: number; name: string };
};
```

Validation error example (400):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid submission", "details": { "link": "INVALID_URL" } } }
```

Version limit reached error (409):
```json
{ "error": { "code": "VERSION_LIMIT_REACHED", "message": "Maximum of 3 versions reached for this milestone" } }
```

## 5. Data specification

New model `Submission` with migration `f03_submissions`:

| Field | Type | Constraint |
|---|---|---|
| `id` | Int | PK, auto-increment |
| `milestoneId` | Int | FK → `Milestone.id`, `ON DELETE RESTRICT` |
| `submittedById` | Int | FK → `User.id`, `ON DELETE RESTRICT` |
| `version` | Int | not null |
| `title` | VARCHAR(120) | not null |
| `description` | VARCHAR(2000) | nullable |
| `link` | VARCHAR(2048) | not null |
| `submittedAt` | TIMESTAMPTZ(3) | default now() |
| `daysLate` | Int | not null, >= 0 |

Constraints:
- `@@unique([milestoneId, version])`
- `@@index([milestoneId, submittedAt])`
- Back-relations: `Milestone.submissions`, `User.submissions`

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| **AC-03-01** | **Given** student1 and milestone on Team Alpha, **when** `POST /api/milestones/:id/submissions` is called with valid data, **then** return `201` with `version = 1`, `daysLate` computed, and submission stored in DB. |
| **AC-03-02** | **Given** a team milestone with version 1, **when** student resubmits, **then** return `201` with `version = 2`, and version 1 remains unchanged in DB. |
| **AC-03-03** | **Given** a team milestone with 3 versions, **when** student attempts a 4th submission, **then** return `409` with error code `VERSION_LIMIT_REACHED`, and nothing is stored. |
| **AC-03-04** | **Given** a milestone deadline, **when** submitted at or before deadline, **then** `daysLate = 0`; **when** submitted after deadline, **then** `daysLate = ceil((submittedAt - deadline) / 24 h)`. |
| **AC-03-05** | **Given** student1, **when** calling `GET /api/milestones/:id/submissions` for own team milestone, **then** return `200` with submissions ordered by `version` ascending. |
| **AC-03-06** | **Given** supervisor1, **when** calling `GET /api/milestones/:id/submissions` for assigned team milestone, **then** return `200` with submissions list. |
| **AC-03-07** | **Given** an out-of-scope user (student of another team or unassigned supervisor), **when** accessing submissions endpoint or single submission, **then** return `404 NOT_FOUND` and no data. |
| **AC-03-08** | **Given** a supervisor, **when** calling `POST /api/milestones/:id/submissions`, **then** return `403 FORBIDDEN` before any scope or validation check. |
| **AC-03-09** | **Given** invalid fields (missing/blank/121-char title, 2001-char description, missing/invalid/2049-char link), **when** student submits, **then** return `400 VALIDATION_ERROR` with per-field `details`, and nothing is stored. |
| **AC-03-10** | **Given** no token, **when** any F-03 endpoint is called, **then** return `401 UNAUTHENTICATED`. |
| **AC-03-11** | **Given** 10 concurrent submission requests for the same milestone, **then** all requests serialize safely, producing unique sequential versions up to 3, and the rest receive `409 VERSION_LIMIT_REACHED` without database constraint errors or duplicate versions. |
| **AC-03-12** | **Given** student on `/student/milestones/:id`, **when** page loads, **then** show milestone details, submissions list with ICT timestamps and late badge, and submission form; when 3 versions exist, show "Maximum of 3 versions reached". |
| **AC-03-13** | **Given** supervisor on `/supervisor/milestones/:id`, **when** page loads, **then** show milestone details, submissions list with submitter name, link, and late badge, with no submission form. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| `TEST-03-01` | AC-03-01 | API + DB | Seeded; student1 token; milestone on Team Alpha | `POST /api/milestones/:id/submissions` valid data | 201; version: 1, submittedById: student1.id, stored in DB | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-02` | AC-03-02 | API + DB | Milestone has version 1; student1 token | `POST /api/milestones/:id/submissions` valid data | 201; version: 2; version 1 record untouched | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-03` | AC-03-03 | API + DB | Milestone has 3 versions; student1 token | `POST /api/milestones/:id/submissions` | 409 `VERSION_LIMIT_REACHED`; count remains 3 | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-04` | AC-03-04 | Unit | Various `submittedAt` vs `deadline` | `calculateDaysLate(submittedAt, deadline)` | on-time -> 0, 1 sec late -> 1, 24 h late -> 1, 24 h 1 s late -> 2 | `server/tests/unit/submission-rules.test.ts` |
| `TEST-03-05` | AC-03-04 | API | Milestone in past; student1 submits | `POST /api/milestones/:id/submissions` | 201; `daysLate > 0` | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-06` | AC-03-05 | API | Milestone with 2 versions; student1 token | `GET /api/milestones/:id/submissions` | 200; array of 2 versions ordered asc | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-07` | AC-03-06 | API | Milestone with versions; supervisor1 token | `GET /api/milestones/:id/submissions` | 200; array of versions with submitter | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-08` | AC-03-07 | API | Milestone on Alpha; student3 (Team Beta), supervisor2 tokens | `GET /api/milestones/:id/submissions` | 404 / 404 `NOT_FOUND` | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-09` | AC-03-07 | API | Milestone on Alpha; student3 token | `POST /api/milestones/:id/submissions` | 404 `NOT_FOUND`; count unchanged | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-10` | AC-03-08 | API | Milestone on Alpha; supervisor1 token | `POST /api/milestones/:id/submissions` | 403 `FORBIDDEN`; count unchanged | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-11` | AC-03-09 | API | supervisor1 / student1; invalid payloads | `POST /api/milestones/:id/submissions` | 400 `VALIDATION_ERROR` with details | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-12` | AC-03-09 | Unit | Validation boundaries | `validateSubmissionInput` | 120 ok / 121 err; valid url ok / bad url err; empty desc -> null | `server/tests/unit/submission-rules.test.ts` |
| `TEST-03-13` | AC-03-10 | API | No token | Call `GET /api/milestones/:id/submissions`, `POST`, `GET /api/submissions/:id` | 401 `UNAUTHENTICATED` | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-14` | AC-03-11 | Integration | 10 concurrent POST submissions | `Promise.all` concurrent requests | Exactly versions 1, 2, 3 created; others get 409; 0 duplicates | `server/tests/api/submissions.api.test.ts` |
| `TEST-03-15` | AC-03-12 | UI | Mocked API: milestone + submissions | Render `/student/milestones/1` | Milestone details, versions, late badge, submit form | `client/tests/Submissions.test.tsx` |
| `TEST-03-16` | AC-03-12 | UI | Mocked API: 3 versions | Render `/student/milestones/1` | "Maximum of 3 versions reached", form hidden | `client/tests/Submissions.test.tsx` |
| `TEST-03-17` | AC-03-13 | UI | Mocked API: milestone + submissions | Render `/supervisor/milestones/1` | Submissions list, submitter name, link, no submit form | `client/tests/Submissions.test.tsx` |

## 8. Definition of Done and evidence

- [x] All AC-03-01..AC-03-13 implemented
- [x] All STS tests executed and passing on a fresh test database — `npm run build && npm test` on `65aaf05`: server 59 passed (F-03: 13 API + 14 unit), client 12 passed (F-03: 3 UI), 0 failed, 0 skipped; E2E smoke 1/1
- [x] TDD red → green: failing tests `cace581` (server 11 failed [TEST-03-08 and TEST-03-09 passed vacuously at red due to unknown route 404; true scope checked at green] + unit file failed to load, client 3 failed) → implementation `65aaf05` (all pass)
- [x] `docs/traceability.md`, `docs/features.md`, sprint-1 README updated
- [ ] PR reviewed by ILoveSiesta and merged into `sprint-1`
