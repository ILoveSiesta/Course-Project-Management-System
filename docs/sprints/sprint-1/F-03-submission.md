# F-03 Submission and Versions — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-03): contract`), then the failing
> tests (`test(F-03): ...`), then the implementation (`feat(F-03): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | phet526 | Initial contract for F-03 (issue #4) |
| 0.2 | 2026-11-21 | ILoveSiesta | Lab 7 change request #59 (CHG-03, approved by TA Kantapat Suwannahong 2026-11-21): BR-05 late window of 7 × 24 h. Changed: §1, §2 (BR-05, check order), §3 (closed-window notice), §4 (`409 SUBMISSION_WINDOW_CLOSED`), §5 (no data change, stated), §6 (AC-03-04 revised; AC-03-14..AC-03-18 new), §7 (TEST-03-18..TEST-03-25 new; TEST-03-15/16 fixture clock revised), §8.1 (DoD of the change). Written and reviewed before any implementation commit. Impact analysis: `docs/labs/lab-07/change-impact.md` |
| 0.3 | 2026-11-21 | ILoveSiesta | §8.1 filled with executed RED/GREEN/regression results (#59). TEST-03-22 precondition corrected from "now − 1 d" to "now − 23 h" before the test commit: an extension to exactly 1 day back makes the next submission slightly more than 24 h late, which BR-05 rounds up to 2 days. No rule change |

## 1. Linked requirements

- **FR:** FR-12 (student submits milestone work), FR-13 (view submissions, late flag and days late), FR-14 (resubmit as new version, earlier versions kept)
- **BR:** BR-01 (student scope: own team), BR-02 (supervisor scope: assigned teams), BR-03 (student-only operation: supervisor POST → 403), BR-05 (late flag and days late calculation), BR-06 (sequential unique versions, concurrency-safe), BR-07 (max 3 versions per team-milestone, 4th rejected), BR-08 (submission validation)
- **NFR:** NFR-02 (401 on protected endpoints), NFR-03 (403/404 without data disclosure), NFR-05 (safe error shape), NFR-06 (concurrent submissions integrity), NFR-12 (understandable rejections)
- **Decisions:** D-01 (late submissions accepted and marked; rev. 0.2: for at most 7 days), D-02 (up to 3 versions), D-07 (title, optional description, link)
- **Approved changes:** CHG-03 (`docs/traceability.md` §5, change request #59) — 7-day late window (v0.2)
- **Assumptions:** A-03 (external link format validated), A-04 (server clock authoritative for daysLate)

## 2. Feature-level design

- **Behaviour and workflow**
  - A student opens a milestone from **My team** (`/student/milestones/:milestoneId`): sees the milestone title, deadline, description, team name; the list of previously submitted versions with their version number, submitter, submission date, external link and late status badge; and a **Submit work** (or **Resubmit work**) form.
  - A supervisor opens a milestone from **Supervisor team detail** (`/supervisor/milestones/:milestoneId`): sees the milestone details and the list of submitted versions with submitter name, timestamp, link and late status badge. Supervisors cannot submit work.
  - Submitting work creates a new version with `version = previous version + 1` (starting at 1). Earlier versions are immutable (never overwritten or updated).
- **Business rules and validation**
  - **BR-05 (Days late and late window, rev. 0.2):**
    - Submissions are accepted after the deadline for at most 7 days (D-01 rev.). *v0.1 rule, replaced by CR #59: "Submissions are accepted after the deadline (D-01)", with no time limit.*
    - **Window:** a submission is accepted when `submittedAt.getTime() <= deadline.getTime() + 7 * 24 * 60 * 60 * 1000` (inclusive boundary, milliseconds, server time). After that the request is rejected with `409 SUBMISSION_WINDOW_CLOSED`, message "Late submissions are accepted up to 7 days after the deadline", and nothing is stored.
    - `daysLate = Math.ceil((submittedAt.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000))` using server time (unchanged).
    - If `submittedAt <= deadline`, `daysLate = 0` (on time).
    - If `submittedAt > deadline`, `daysLate >= 1` (even 1 second late counts as 1 day late); an accepted submission has `daysLate` ≤ 7.
    - **Deadline used:** the milestone's deadline read inside the locked transaction at the moment of submission. If a supervisor extends the deadline (F-05, BR-13), the window moves with it, also when the old window had closed; this is a change to the milestone, not an override. No other role or action can bypass the window.
    - **Historical data:** versions stored before v0.2 (possibly with `daysLate` > 7) are not changed, recalculated or hidden; reads return them as before.
    - **Pure helpers** (`server/src/utils/submissionValidation.ts`): `calculateDaysLate(submittedAt, deadline)` (unchanged) and new `isWithinLateWindow(submittedAt, deadline)`; the service passes the same `now` to both, so the two rules cannot disagree. The client applies the same rule only to decide whether to show the closed-window notice; the server decision is authoritative.
  - **BR-06 & BR-07 (Version limit and concurrency):**
    - Each milestone allows at most 3 versions (D-02).
    - When `count >= 3`, submitting throws `409 VERSION_LIMIT_REACHED` with message "Maximum of 3 versions reached for this milestone".
    - **Order of the two 409 rules (v0.2):** inside the transaction the version limit is checked **before** the late window, so a team with 3 versions keeps getting `VERSION_LIMIT_REACHED` (Sprint 1 behaviour unchanged) even after the window has closed.
    - Concurrency safety (NFR-06): creation runs inside a database transaction (`prisma.$transaction`) with a row lock (`FOR UPDATE` on `Milestone`) and a database unique constraint `@@unique([milestoneId, version])` preventing race conditions or duplicate version numbers.
  - **BR-08 (Field validation):**
    - `title`: required, trimmed, 1–120 characters (`REQUIRED`, `TOO_LONG`).
    - `description`: optional; empty string is stored as `null`; at most 2000 characters (`TOO_LONG`, `INVALID_TYPE`).
    - `link`: required, valid absolute `http` or `https` URL, at most 2048 characters (`REQUIRED`, `TOO_LONG`, `INVALID_URL`, `INVALID_TYPE`).
- **Access and check order (SDS §4–§5):**
  - Check order: authenticate (401) → role (403) → record scope (404) → validation (400) → business rule (409: version limit, then late window). A closed window never changes the 401/403/404/400 answers.
  - Student: may view submissions and submit work only for milestones belonging to their own team (`memberships: { some: { studentId: user.id } }`).
  - Supervisor: may view submissions only for milestones belonging to assigned teams (`supervisorAssignments: { some: { supervisorId: user.id } }`). Calling `POST /api/milestones/:id/submissions` returns `403 FORBIDDEN` immediately.
  - Out-of-scope or non-existent milestone/submission → `404 NOT_FOUND` (no data disclosure). Non-numeric or non-positive IDs yield 404.

## 3. UI specification

| Screen | Route | Content | States |
|---|---|---|---|
| Student milestone detail | `/student/milestones/:milestoneId` | Back to My team link; milestone title, deadline (ICT), description; submission versions list; submit/resubmit form | Loading; not found/not allowed; empty submissions ("No submissions yet"); field errors under inputs; disabled submit button while saving; version limit reached notice ("Maximum of 3 versions reached"); late window closed notice ("Late submissions are accepted up to 7 days after the deadline", v0.2) |
| Supervisor milestone detail | `/supervisor/milestones/:milestoneId` | Back to team link; milestone title, deadline (ICT), description; submission versions list with submitter name, link, late badge | Loading; not found/not allowed; empty submissions ("No submissions yet") |

- Deadlines and submission times are formatted in Asia/Bangkok time, e.g. `8 Nov 2026, 23:59 (ICT)` (A-04).
- Submission versions display:
  - Header: `Version N`
  - Badge: `.badge.badge-success` "On time" if `daysLate === 0`; `.badge.badge-warning` `Late (+N d)` if `daysLate > 0`.
  - Submitter: `Submitted by: <name>` at `<formatted date>`
  - Link: `<a href={link} target="_blank" rel="noreferrer">`
  - Description: if present.
- When 3 versions exist: the submission form is replaced by a clear notice: "Maximum of 3 versions reached for this milestone."
- **Late window closed (v0.2):** when fewer than 3 versions exist and the browser time is later than `deadline + 7 × 24 h`, the form is replaced by `<p className="alert">Late submissions are accepted up to 7 days after the deadline.</p>`; the versions list (with their feedback) is still shown. When 3 versions exist, the version-limit notice is shown instead (same order as the API).
- If the server rejects a submission with `409 SUBMISSION_WINDOW_CLOSED` (for example, the browser clock is behind the server), the API message is shown in the form alert (`role="alert"`) and the form values are kept.
- Supervisor milestone detail: no change (it has no submission form).
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

Late window closed error (409, v0.2):
```json
{ "error": { "code": "SUBMISSION_WINDOW_CLOSED", "message": "Late submissions are accepted up to 7 days after the deadline" } }
```

v0.2 changes no route, request or success shape. `GET` endpoints are not affected by the window. The milestone response (F-02) is unchanged; the client derives the closed-window notice from `deadline`.

## 5. Data specification

**v0.2: no data change.** The late window is computed from the existing `Milestone.deadline` and the submission time; no column, constraint or migration is added, and existing `daysLate` values are not recalculated (the `>= 0` check stays; no `<= 7` constraint is added because pre-change rows may exceed 7).


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
| **AC-03-04** (rev. 0.2) | **Given** a milestone deadline, **when** submitted at or before deadline, **then** `daysLate = 0`; **when** submitted after the deadline and no later than `deadline + 7 × 24 h`, **then** `201` and `daysLate = ceil((submittedAt - deadline) / 24 h)` (1–7). *v0.1: "when submitted after deadline, then `daysLate = ceil((submittedAt - deadline) / 24 h)`", with no upper limit.* |
| **AC-03-05** | **Given** student1, **when** calling `GET /api/milestones/:id/submissions` for own team milestone, **then** return `200` with submissions ordered by `version` ascending. |
| **AC-03-06** | **Given** supervisor1, **when** calling `GET /api/milestones/:id/submissions` for assigned team milestone, **then** return `200` with submissions list. |
| **AC-03-07** | **Given** an out-of-scope user (student of another team or unassigned supervisor), **when** accessing submissions endpoint or single submission, **then** return `404 NOT_FOUND` and no data. |
| **AC-03-08** | **Given** a supervisor, **when** calling `POST /api/milestones/:id/submissions`, **then** return `403 FORBIDDEN` before any scope or validation check. |
| **AC-03-09** | **Given** invalid fields (missing/blank/121-char title, 2001-char description, missing/invalid/2049-char link), **when** student submits, **then** return `400 VALIDATION_ERROR` with per-field `details`, and nothing is stored. |
| **AC-03-10** | **Given** no token, **when** any F-03 endpoint is called, **then** return `401 UNAUTHENTICATED`. |
| **AC-03-11** | **Given** 10 concurrent submission requests for the same milestone, **then** all requests serialize safely, producing unique sequential versions up to 3, and the rest receive `409 VERSION_LIMIT_REACHED` without database constraint errors or duplicate versions. |
| **AC-03-12** | **Given** student on `/student/milestones/:id`, **when** page loads, **then** show milestone details, submissions list with ICT timestamps and late badge, and submission form; when 3 versions exist, show "Maximum of 3 versions reached". |
| **AC-03-13** | **Given** supervisor on `/supervisor/milestones/:id`, **when** page loads, **then** show milestone details, submissions list with submitter name, link, and late badge, with no submission form. |
| **AC-03-14** (new, v0.2) | **Given** a milestone and a team with fewer than 3 versions, **when** a student of the team submits valid data at exactly `deadline + 7 × 24 h`, **then** `201` with `daysLate = 7`; **when** at `deadline + 7 × 24 h + 1 ms` or later, **then** `409 SUBMISSION_WINDOW_CLOSED` with the documented message, and the number of stored versions is unchanged. |
| **AC-03-15** (new, v0.2) | **Given** a milestone whose late window has closed, **when** a team with 3 versions submits, **then** `409 VERSION_LIMIT_REACHED` (version limit first); **when** invalid fields are sent, **then** `400 VALIDATION_ERROR`; **when** a supervisor submits, **then** `403`; **when** a student of another team submits, **then** `404`; **when** no token is sent, **then** `401`. Nothing is stored in any case. |
| **AC-03-16** (new, v0.2) | **Given** versions stored before the change with `daysLate` > 7, **when** the team's student or an assigned supervisor reads the milestone's submissions or a single submission, **then** `200` with those versions and their stored `daysLate` unchanged. |
| **AC-03-17** (new, v0.2) | **Given** a milestone whose late window has closed, **when** an assigned supervisor extends the deadline (F-05) so that the new `deadline + 7 × 24 h` is in the future and the student submits, **then** `201` with `daysLate` calculated from the new deadline. |
| **AC-03-18** (new, v0.2) | **Given** a student on `/student/milestones/:id` for a milestone whose late window has closed and fewer than 3 versions, **when** the page loads, **then** the submit form is replaced by "Late submissions are accepted up to 7 days after the deadline" and the existing versions are still listed; **when** the API answers `409 SUBMISSION_WINDOW_CLOSED`, **then** its message is shown in an alert. |

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
| `TEST-03-18` | AC-03-04, AC-03-14 | Unit | `deadline = 2026-11-08T23:59:00.000Z`; time passed in as an argument | `isWithinLateWindow(t, deadline)` and `calculateDaysLate(t, deadline)` | before deadline → true; at deadline → true; deadline + 7 d → true and daysLate 7; deadline + 7 d + 1 ms → false; deadline + 30 d → false | `server/tests/unit/submission-rules.test.ts` › TEST-03-18 |
| `TEST-03-19` | AC-03-14, AC-03-04 | API + DB | Milestone on Alpha with `deadline = realNow − 7 d` (inserted directly, because creation requires a future deadline); fake clock `vi.useFakeTimers({ toFake: ["Date"] })` (only `Date` is faked, so timers used by Supertest/Prisma keep working; the faked time stays within the token lifetime) | `vi.setSystemTime(deadline + 7 d)` → student1 POST; then `vi.setSystemTime(deadline + 7 d + 1 ms)` → student1 POST | First `201`, version 1, `daysLate 7`; second `409 SUBMISSION_WINDOW_CLOSED` with the message; DB count stays 1 | `server/tests/api/submissions.api.test.ts` › TEST-03-19 |
| `TEST-03-20` | AC-03-15 | API + DB | Milestone on Alpha with `deadline = now − 8 d`; (a) 3 versions inserted directly; (b) a second such milestone with no versions | (a) student1 POST valid; (b) student1 POST invalid link; supervisor1 POST; student3 (Team Beta) POST; POST without token | (a) `409 VERSION_LIMIT_REACHED`; (b) `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `401 UNAUTHENTICATED`; DB count unchanged in every case | `server/tests/api/submissions.api.test.ts` › TEST-03-20 |
| `TEST-03-21` | AC-03-16 | API + DB | Milestone on Alpha with `deadline = now − 30 d`; version 1 inserted directly with `daysLate = 12` (data stored before the change) | GET list as student1 and as supervisor1; GET `/api/submissions/:id` as student1 | `200`; version 1 present with `daysLate: 12` in all three responses | `server/tests/api/submissions.api.test.ts` › TEST-03-21 |
| `TEST-03-22` | AC-03-17 | API + DB | Milestone on Alpha with `deadline = now − 10 d`; student1 POST → `409 SUBMISSION_WINDOW_CLOSED` (control) | supervisor1 `PATCH /api/milestones/:id` with deadline = now − 23 h (v0.3; was now − 1 d); student1 POST | `PATCH 200`; POST `201`, `daysLate 1` (from the new deadline) | `server/tests/api/submissions.api.test.ts` › TEST-03-22 |
| `TEST-03-23` | AC-03-18 | UI | Mocked API: milestone with deadline `2026-11-01T16:59:00.000Z` and 1 version; fake clock at `2026-11-09T00:00:00.000Z` (window closed) | Render `/student/milestones/1` | Notice "Late submissions are accepted up to 7 days after the deadline"; version 1 listed; no "Submission title" field | `client/tests/Submissions.test.tsx` › TEST-03-23 |
| `TEST-03-24` | AC-03-18 | UI | Mocked API: window open in the browser; POST answers `409 SUBMISSION_WINDOW_CLOSED` | Fill and submit the form | Alert with the API message; form values kept; no new version listed | `client/tests/Submissions.test.tsx` › TEST-03-24 |
| `TEST-03-25` | AC-03-04 (regression) | E2E (existing) | Existing journeys use future deadlines | `npm run test:e2e` | TEST-E2E-01, TEST-E2E-02 and the #54 spec still pass (normal and rejection journeys unaffected) | `e2e/*.spec.ts` |

**Revised existing tests (v0.2).** `TEST-03-15` and `TEST-03-16` render a milestone with the fixed deadline `2026-11-08T16:59:00.000Z`. Once the window rule exists, a run after 2026-11-15 would hide the form for a reason unrelated to those tests. The test file therefore sets a fake clock (`vi.useFakeTimers({ toFake: ["Date"] })`, `vi.setSystemTime("2026-11-09T00:00:00.000Z")`) so both tests keep checking what they checked before; their assertions are unchanged. `TEST-03-05` (deadline 2 days ago) stays inside the window and is unchanged. No other existing test is changed, skipped or weakened.

## 8. Definition of Done and evidence

- [x] All AC-03-01..AC-03-13 implemented
- [x] All STS tests executed and passing on a fresh test database — `npm run build && npm test` on `65aaf05`: server 59 passed (F-03: 13 API + 14 unit), client 12 passed (F-03: 3 UI), 0 failed, 0 skipped; E2E smoke 1/1
- [x] TDD red → green: failing tests `cace581` (server 11 failed [TEST-03-08 and TEST-03-09 passed vacuously at red due to unknown route 404; true scope checked at green] + unit file failed to load, client 3 failed) → implementation `65aaf05` (all pass)
- [x] `docs/traceability.md`, `docs/features.md`, sprint-1 README updated
- [ ] PR reviewed by ILoveSiesta and merged into `sprint-1`

### 8.1 Definition of Done — v0.2 change (CR #59, Lab 7)

- [x] Contract v0.2 and impact analysis reviewed by phet526 and merged into `sprint-2` **before** the implementation commit — PR #71, approved 2026-11-21 14:39:00 ICT, merge `c82a867`
- [x] Pre-change commit recorded in #59 before the RED run — `c82a867` (BR-05 code identical to `9dd9239`)
- [x] RED: `f5deaf7` `test(F-03)` (test files only), run on the pre-change code: `npm run build` passes (no compile error); server `npx vitest run` **3 failed / 98 passed**, client `npx vitest run` **1 failed / 20 passed**, 0 skipped. Failures: TEST-03-19 `expected 201 to be 409` (the request 1 ms after the window was stored), TEST-03-22 `expected 201 to be 409` (closed-window control accepted), TEST-03-23 notice not found (form still shown), TEST-03-18 `isWithinLateWindow is not a function` (helper missing; not the behavioural evidence). TEST-03-20, TEST-03-21 and TEST-03-24 passed at RED as expected (regression guards); TEST-03-15/16 pass with the fixed clock
- [x] GREEN: `8259688` `feat(F-03)`; the same tests pass; diff limited to `submissionValidation.ts`, `submissions.service.ts`, `StudentMilestone.tsx` and new `client/src/submissionWindow.ts`
- [x] Regression on `8259688`: `npm run build` OK; `npm test` server **101 passed** (12 files), client **21 passed** (6 files); `npm run test:e2e` **4 passed**; `python -m unittest discover -s deploy/tests` **17 OK**; 0 failed, 0 skipped; CI `test-and-docker` on the PR (see PR)
- [ ] PR into `sprint-2` reviewed by phet526 (approve before merge); released to `main` through the Deploy demo pipeline; post-deployment check of the changed rule and of a preserved Sprint 1 domain/access path
- [ ] `docs/traceability.md` BR-05 and AC-03-14..AC-03-18 rows updated with actual tests, result and version
