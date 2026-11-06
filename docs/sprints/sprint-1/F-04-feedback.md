# F-04 Feedback — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-04): contract`), then the failing
> tests (`test(F-04): ...`), then the implementation (`feat(F-04): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | ILoveSiesta | Initial contract for F-04 (issue #5) |
| 0.2 | 2026-11-06 | ILoveSiesta | Definition of Done filled with executed results; no behaviour change |

## 1. Linked requirements

- **FR:** FR-16 (supervisor records feedback on a submission version), FR-17 (students view feedback)
- **BR:** BR-01 (student scope), BR-02 (supervisor scope), BR-03 (supervisor-only operation), BR-09 (comment 1–5000 characters, one version, append-only, kept after resubmission)
- **NFR:** NFR-02 (401 on the new endpoint), NFR-03 (403/404 without data), NFR-05 (safe error shape), NFR-12 (UI shows the reason for a rejection)
- **Decisions:** D-03 (feedback visible to the team as soon as it is recorded), D-08 (feedback cannot be edited; add a new entry instead)

## 2. Feature-level design

- **Behaviour and workflow**
  - On **Supervisor milestone detail** (`/supervisor/milestones/:id`) each submission version has an **Add feedback** form. Submitting it stores a feedback entry for that exact version with the supervisor as author and shows it under the version immediately.
  - A version can receive several feedback entries; they are listed oldest first.
  - On **Student milestone detail** (`/student/milestones/:id`) every version shows its feedback entries (author, time in ICT, comment). There is no feedback form for students.
  - Submissions returned by the F-03 endpoints (`GET /api/milestones/:id/submissions`, `GET /api/submissions/:id`) now include their `feedback` array, so both screens get feedback with the submissions in one request.
- **Business rules and validation (BR-09)**
  - `comment`: required string, trimmed, 1–5000 characters.
  - A feedback entry belongs to exactly one submission version. Submitting a new version creates a new submission row; existing feedback stays on the version it was written for.
  - There is no endpoint to edit or delete feedback (D-08).
- **Access (BR-01..BR-03, SDS §4–§5)** — check order: authenticate (401) → role (403) → record scope (404) → validation (400).
  - `POST` feedback: Supervisor only; a student gets `403 FORBIDDEN` and nothing is stored.
  - The submission must belong to a milestone of a team the supervisor is assigned to; otherwise `404 NOT_FOUND` and nothing is stored. Unknown and non-numeric IDs → 404.
  - Reading feedback follows the existing submission scope: own team for students, assigned teams for supervisors.
- **Dependencies**: F-01 (auth, roles), F-02 (`scopeFilter`, `HttpError`, `parseId`), F-03 (submissions, `SubmissionList`).
- **Test infrastructure**: the Vitest global setup also regenerates the Prisma client after resetting `cpms_test`, so a branch that changes `schema.prisma` does not fail on a stale client. If generation fails (e.g. the engine file is locked by a running dev server), the setup prints a warning and continues.

## 3. UI specification

| Screen | Change | States |
|---|---|---|
| Supervisor milestone detail | Under each version: feedback list + form (textarea "Feedback for version N", button "Add feedback") | Empty: "No feedback yet."; saving: button disabled, "Saving…"; field error under the textarea; other errors in an alert |
| Student milestone detail | Under each version: feedback list (read-only) | Empty: "No feedback yet." |

- Feedback entry shows the comment, then "by {author name} on {time} (ICT)" using `formatDeadline`.
- Field error texts: `REQUIRED` → "Required"; `TOO_LONG` → "Too long (max 5000 characters)"; `INVALID_TYPE` → "Invalid value".
- A `401` logs the user out (SDS §3.2). Styling uses classes in `client/src/theme.css` only (SDS §3.2).

## 4. API specification

| Method | Path | Auth / role | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/submissions/:submissionId/feedback` | Supervisor, assigned team | `{ comment: string }` | `201 { feedback: Feedback }` | 401, 403, 404, 400 |
| GET | `/api/milestones/:milestoneId/submissions` | Any, in scope (F-03) | — | each `Submission` now has `feedback: Feedback[]` (oldest first) | unchanged |
| GET | `/api/submissions/:submissionId` | Any, in scope (F-03) | — | `Submission` now has `feedback: Feedback[]` | unchanged |

```ts
type Feedback = {
  id: number; submissionId: number; comment: string; createdAt: string;
  author: { id: number; name: string };
};
```

Validation error example:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid feedback", "details": { "comment": "REQUIRED" } } }
```

## 5. Data specification

New model `Feedback` with migration `f04_feedback`:

| Field | Type | Constraint |
|---|---|---|
| `id` | Int | PK, auto-increment |
| `submissionId` | Int | FK → `Submission.id`, `ON DELETE RESTRICT` |
| `authorId` | Int | FK → `User.id`, `ON DELETE RESTRICT` |
| `comment` | VARCHAR(5000) | not null |
| `createdAt` | TIMESTAMPTZ(3) | default now() |

Index `(submissionId, createdAt)`. Back-relations: `Submission.feedback`, `User.feedbackGiven`. No change to F-01–F-03 tables. Seed unchanged.

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-04-01 | Given supervisor1 (assigned to Team Alpha) and a version on an Alpha milestone, when `POST /api/submissions/:id/feedback` with a valid comment, then `201` with the feedback, stored with that `submissionId` and `authorId` = supervisor1. |
| AC-04-02 | Given a version with feedback, when the supervisor adds another entry, then both are stored and returned oldest first. |
| AC-04-03 | Given student1, when posting feedback on their own team's version, then `403 FORBIDDEN` and nothing is stored. |
| AC-04-04 | Given supervisor2 (not assigned to Alpha), when posting feedback on an Alpha version, then `404 NOT_FOUND` and nothing is stored; unknown and non-numeric submission IDs also give 404. |
| AC-04-05 | Given an invalid comment (missing, blank, 5001 characters, not a string), when posting, then `400 VALIDATION_ERROR` with `details.comment` and nothing is stored; exactly 5000 characters is accepted. |
| AC-04-06 | Given feedback on version 1, when the team submits version 2, then the feedback is still attached to version 1 and version 2 has no feedback. |
| AC-04-07 | Given feedback on a version, when an in-scope student or supervisor lists the milestone's submissions or opens the submission, then each version includes its feedback (comment, author, createdAt). |
| AC-04-08 | Given no token, when posting feedback, then `401 UNAUTHENTICATED`. |
| AC-04-09 | Given existing feedback, when a client tries `PATCH` or `DELETE` on it, then the API offers no such operation (404) and the feedback is unchanged. |
| AC-04-10 | Given a supervisor on milestone detail, when adding feedback with a valid comment, then it appears under that version; when the API returns a validation error, the message appears under the textarea. |
| AC-04-11 | Given a student on milestone detail, when a version has feedback, then the comment, author and ICT time are shown, and no feedback form is shown. |

## 7. Software Test Specification (STS)

Negative API tests include a positive control (an action that must succeed) in the same test, so they cannot pass just because the endpoint does not exist yet.

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-04-01 | AC-04-01 | API + DB | Alpha milestone with version 1; supervisor1 token | POST valid comment | 201; DB row with submissionId, authorId supervisor1, trimmed comment | `server/tests/api/feedback.api.test.ts` › TEST-04-01 |
| TEST-04-02 | AC-04-02 | API | Version with one entry | POST second comment, then list submissions | 2 entries, oldest first | same file › TEST-04-02 |
| TEST-04-03 | AC-04-03 | API + DB | student1 token | POST valid comment (control: supervisor1 succeeds on same version) | Student 403 `FORBIDDEN`; feedback count unchanged by the student call | same file › TEST-04-03 |
| TEST-04-04 | AC-04-04 | API + DB | supervisor2 token; unknown ID; `abc` | POST valid comment (control: supervisor1 succeeds) | 404 / 404 / 404; count unchanged by those calls | same file › TEST-04-04 |
| TEST-04-05 | AC-04-05 | API + DB | supervisor1 token | POST each invalid body; then 5000 chars | 400 with `details.comment` (REQUIRED / REQUIRED / TOO_LONG / INVALID_TYPE); count unchanged; 5000 → 201 | same file › TEST-04-05 |
| TEST-04-06 | AC-04-06 | API + DB | Feedback on version 1 | student1 submits version 2; list submissions | v1 still has its feedback; v2 has `feedback: []` | same file › TEST-04-06 |
| TEST-04-07 | AC-04-07 | API | Feedback on a version | GET list and GET single as student1 and supervisor1 | `feedback` with comment, author name, createdAt | same file › TEST-04-07 |
| TEST-04-08 | AC-04-08 | API | No token (control: supervisor1 succeeds) | POST | 401 `UNAUTHENTICATED` | same file › TEST-04-08 |
| TEST-04-09 | AC-04-09 | API + DB | Existing feedback | PATCH and DELETE on `/api/submissions/:id/feedback/:feedbackId` as supervisor1 | 404 both; stored comment unchanged | same file › TEST-04-09 |
| TEST-04-10 | AC-04-05 | Unit | — | `validateFeedbackInput` boundaries | 5000 ok, 5001 TOO_LONG, blank REQUIRED, number INVALID_TYPE, trimmed result | `server/tests/unit/feedback-validation.test.ts` |
| TEST-04-11 | AC-04-10 | UI | Mocked API: milestone + version without feedback | Supervisor types comment, clicks "Add feedback" | POST body `{ comment }`; entry shown under the version | `client/tests/Feedback.test.tsx` › TEST-04-11 |
| TEST-04-12 | AC-04-10 | UI | Mocked API returns 400 `details.comment = REQUIRED` | Click "Add feedback" | "Required" shown under the textarea | same file › TEST-04-12 |
| TEST-04-13 | AC-04-11 | UI | Mocked API: version with feedback | Render `/student/milestones/10` | Comment, "by Supervisor One", ICT time shown; no "Add feedback" button | same file › TEST-04-13 |

## 8. Definition of Done and evidence

- [x] All AC-04-01..AC-04-11 implemented
- [x] All STS tests executed and passing on a fresh database — `npm run build && npm test` on `35b29a7`: server 73 passed (F-04: 9 API + 5 unit), client 15 passed (F-04: 3 UI), 0 failed, 0 skipped; E2E smoke 1/1
- [x] TDD red → green: failing tests `e26be7a` (all 9 F-04 API tests failed — each negative test has a positive control, so none passed only because the route was missing; unit file failed to load; client 3 failed; existing 59 server + 12 client passed) → implementation `35b29a7` (all pass)
- [x] `docs/traceability.md`, `docs/features.md`, sprint-1 README, AI-use updated
- [ ] PR reviewed by phet526 and merged into `sprint-1`
