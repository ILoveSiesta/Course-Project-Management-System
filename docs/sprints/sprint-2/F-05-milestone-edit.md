# F-05 Milestone Editing and Deadline Extension — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-05): contract`), then the failing
> tests (`test(F-05): ...`), then the implementation (`feat(F-05): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-21 | ILoveSiesta | Initial contract for F-05 (issue #62) |
| 0.2 | 2026-11-21 | ILoveSiesta | Definition of Done filled with executed results; no behaviour change |
| 0.3 | 2026-11-21 | ILoveSiesta | §2 note on the BR-05 7-day late window (CHG-03, Lab 7 #59): an extension also moves the window; no F-05 behaviour, code or test change (covered by TEST-03-22 in F-03 v0.2) |
| 0.4 | 2026-11-22 | phet526 | Defect #90 (`DEF-BAD-INPUT`): reject NUL (`U+0000`) and unpaired UTF-16 surrogates in `title`/`description` (`INVALID_CHARACTER`, `"Contains an unsupported character"`), bound `deadline` UTC years to `1–9999` (`INVALID_DATE`), and link SDS §4 |
| 0.5 | 2026-11-23 | ILoveSiesta | Defect #94 group A (`DEF-DEADLINE`): §2 `deadline` uses the exact F-02 v0.5 format (zone required; impossible and non-ISO dates → `INVALID_DATE`, nothing stored); §3 the edit form shows "Invalid date" for a date the browser cannot convert, without a request; AC-05-05 revised, AC-05-10 new; TEST-05-11, TEST-05-12 new; §8.1 added. Written before the regression tests |

## 1. Linked requirements

- **FR:** FR-10 (a supervisor edits a milestone's title and description and extends its deadline)
- **BR:** BR-13 (deadline can only be extended; effect on existing versions — detailed by this contract, SRS v0.6), BR-04 (title/description field rules), BR-02 (supervisor scope: assigned teams), BR-03 (supervisor-only operation → 403 for students), BR-05 (days late of a submission, calculated at submission time)
- **NFR:** NFR-02 (401 on the new endpoint), NFR-03 (403/404 without data), NFR-05 (safe error shape), NFR-06-style integrity (concurrent edits never move a deadline earlier), NFR-12 (UI shows the reason for a rejection)
- **Decisions:** D-01 (late submissions accepted with days late), D-04 (several supervisors per team: any assigned supervisor may edit)

## 2. Feature-level design

- **Behaviour and workflow**
  - On **Supervisor milestone detail** (`/supervisor/milestones/:milestoneId`) an assigned supervisor opens **Edit milestone**, changes the title, description and/or deadline, and saves. The milestone card shows the new values; students see them on their pages through the existing F-02 reads.
  - The update is a partial update: only the fields present in the request change.
- **Business rules and validation (shared rules in SDS §4)**
  - `title` (if present): string, trimmed, 1–120 characters, no NUL (`U+0000`) or unpaired UTF-16 surrogates (`INVALID_CHARACTER`).
  - `description` (if present): string ≤ 2000 characters or `null`, no NUL or unpaired UTF-16 surrogates (`INVALID_CHARACTER`); an empty or blank string clears it (stored as `null`), as on creation (BR-04).
  - `deadline` (if present): ISO 8601 date-time `YYYY-MM-DDTHH:mm[:ss[.fff]]` with a **required** zone (`Z` or `±HH:MM`), UTC year in `1–9999`, and a date and time that exist in the calendar (29 February only in leap years) — the same rule and examples as F-02 §2 (v0.5, #94). Anything else is `INVALID_DATE` and nothing in the request is stored; before v0.5 strings such as `2027-02-30T12:00:00Z` were stored as another date, which BR-13 then prevented from being moved back.
  - At least one of `title`, `description`, `deadline` must be present; an empty body is a validation error.
  - **BR-13 (extend only):** a new deadline must be **later than or equal to** the stored deadline. An earlier deadline, even by 1 ms, is rejected with `409 DEADLINE_NOT_EXTENDED` and **nothing in the request is stored** (also not the title or description sent with it). The same deadline is accepted (no change).
  - A deadline that has already passed may be extended, including to another past time (used to reopen work for a team); the creation rule "deadline later than now" (BR-04) applies only when a milestone is created.
  - **BR-13 (effect on existing versions):** `daysLate` of versions already submitted stays as stored, because it was calculated against the deadline in force at submission time (BR-05). Submissions made after the change use the new deadline. No stored submission is recalculated.
  - **Interaction with the BR-05 late window (v0.3 note, CHG-03):** late submissions are accepted up to `deadline + 7 × 24 h`, measured from the deadline in force at submission time. Extending a deadline therefore also moves the window and can reopen a closed one; this is the intended way for a supervisor to give a team more time, not an override. F-05 behaviour and code do not change; the case is tested in F-03 (TEST-03-22).
- **Integrity:** the deadline rule is enforced in the same database statement that writes the change (conditional update `WHERE id = :id AND deadline <= :newDeadline`), so two concurrent edits can never leave the deadline earlier than one that was already accepted.
- **Access and check order** (SDS §4–§5): authenticate (401) → role (403) → record scope (404) → validation (400) → business rule (409).
  - Supervisor: milestones of teams with a `SupervisorAssignment` (D-04: any assigned supervisor).
  - Student: `PATCH` → `403 FORBIDDEN` before any scope or validation check; nothing changes.
  - Unassigned supervisor, unknown or non-numeric milestone ID → `404 NOT_FOUND` with no data; nothing changes.
- **Failure and boundary cases:** new deadline = stored deadline → 200, unchanged; stored − 1 ms → 409; stored + 1 ms → 200; title of 120 characters → accepted, 121 → 400; blank title → 400; invalid date → 400; empty body → 400.
- **Dependencies:** F-02 (milestones, scope helpers, `validateMilestoneInput` rules), F-03 (`daysLate` stored per version), F-01 (`authenticate`, `requireRole`).

## 3. UI specification

| Screen | Route | Change | States |
|---|---|---|---|
| Supervisor milestone detail | `/supervisor/milestones/:milestoneId` | New **Edit milestone** button on the milestone card. It opens a form with **Title**, **Description** and **Deadline** (`datetime-local`), filled with the current values, and **Save changes** / **Cancel** buttons | Saving: button disabled, text "Saving…"; success: form closes and the card shows the new title, description and deadline (ICT); field errors under inputs (same texts as F-02); rule rejection (409): the API message in an alert above the form, e.g. "The deadline can only be extended, not moved earlier"; 401 → logout |
| Student pages (`/student`, `/student/milestones/:id`) | — | No UI change: they already read the milestone through F-02 and show the stored values | — |
| Supervisor team detail (`/supervisor/teams/:teamId`) | — | No UI change: the milestone list reads the stored values | — |

- **Client date check (v0.5, #94):** if the browser cannot turn the Deadline input into a date with a year in `1–9999`, the form shows "Invalid date" under Deadline, sends no request and keeps the form open; no uncaught exception.
- Only fields whose value differs from the loaded milestone are sent. The deadline input shows minutes only, so an untouched deadline is **not** sent (sending the minute-rounded value could move it earlier by the seconds part and be rejected).
- Field error texts: `REQUIRED` → "Required"; `TOO_LONG` → "Too long (max N characters)"; `INVALID_DATE` → "Invalid date"; `INVALID_TYPE` → "Invalid value"; `INVALID_CHARACTER` → "Contains an unsupported character"; `NO_CHANGES` → "Change at least one field".
- Students have no edit control (usability only; the API enforces BR-03).
- Styling uses the shared classes in `client/src/theme.css` (`card`, `form-field`, `has-error`, `field-error`, `btn`, `btn-secondary`, `alert`); no inline styles.

## 4. API specification

All responses use the JSON error shape from SDS §4. IDs are integers; timestamps are ISO 8601 UTC strings.

| Method | Path | Auth / role | Request | Success | Errors |
|---|---|---|---|---|---|
| PATCH | `/api/milestones/:milestoneId` | Supervisor, assigned | `{ title?: string, description?: string \| null, deadline?: string }` (at least one) | `200 { milestone: Milestone }` (same `Milestone` shape as F-02, with the stored values after the update) | 401, 403, 404, 400, 409 |

No change to existing endpoints. `GET /api/milestones/:id` and `GET /api/teams/:teamId/milestones` return the updated values.

Validation error example (400):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid milestone", "details": { "title": "TOO_LONG" } } }
```

`details` values: `REQUIRED` (blank title), `TOO_LONG`, `INVALID_DATE` (including year outside `1–9999`), `INVALID_TYPE`, `INVALID_CHARACTER`, and `NO_CHANGES` under the key `body` for an empty request.

Rule rejection (409):

```json
{ "error": { "code": "DEADLINE_NOT_EXTENDED", "message": "The deadline can only be extended, not moved earlier" } }
```

## 5. Data specification

No schema change and no migration: `Milestone.title`, `description` and `deadline` already exist (F-02). Stored `Submission.daysLate` values are never recalculated (BR-13).

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-05-01 | Given supervisor1 (assigned to Alpha) and a milestone on Alpha, when `PATCH /api/milestones/:id` with a new title and description, then `200` with the new values, and `GET /api/milestones/:id` returns them; fields not sent are unchanged. |
| AC-05-02 | Given a milestone, when the assigned supervisor sends a later deadline, then `200` and the new deadline is stored; the same deadline is accepted unchanged; a deadline that has already passed can be extended. |
| AC-05-03 | Given a milestone, when the assigned supervisor sends a deadline earlier than the stored one (also 1 ms earlier), then `409 DEADLINE_NOT_EXTENDED` and nothing in the request is stored (deadline, title and description unchanged). |
| AC-05-04 | Given a milestone on Alpha, when student1 sends `PATCH`, then `403 FORBIDDEN`; when supervisor2 (not assigned) sends it, or the ID is unknown or non-numeric, then `404 NOT_FOUND` without data; without a token, `401 UNAUTHENTICATED`. In every case nothing changes, while supervisor1 can edit the same milestone. |
| AC-05-05 | Given invalid input (blank or 121-character title, 2001-character description, invalid date, wrong types, empty body), when the assigned supervisor sends `PATCH`, then `400 VALIDATION_ERROR` with per-field `details` and nothing changes. A 120-character title is accepted. *(rev. v0.5, #94)* An invalid date includes an impossible calendar date, a date-only value, a value without a zone and any non-ISO string (F-02 §2); nothing else in the request is stored. |
| AC-05-10 | Given the Edit milestone form, when the Deadline input holds a value the browser cannot convert to a date with a year in `1–9999`, then "Invalid date" is shown under Deadline, no request is sent and the card keeps the old values (v0.5, #94). |
| AC-05-06 | Given a milestone whose deadline has passed and a version submitted late (`daysLate` > 0), when the deadline is extended into the future and the team submits again, then the earlier version keeps its stored `daysLate` and the new version has `daysLate = 0` (BR-13, BR-05). |
| AC-05-07 | Given two concurrent `PATCH` requests extending the same deadline to +5 days and +3 days, then the stored deadline is +5 days afterwards, whichever request runs first (the deadline never ends earlier than an accepted extension). |
| AC-05-08 | Given a supervisor on Supervisor milestone detail, when they edit the title and extend the deadline and save, then the card shows the new title and deadline (ICT) and the request contains only the changed fields. |
| AC-05-09 | Given the edit form, when the API returns `409 DEADLINE_NOT_EXTENDED` or `400` details, then the rule message is shown in an alert or each field message under its field, and the card keeps the old values. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-05-01 | AC-05-01 | API + DB | Seeded; supervisor1 token; milestone on Alpha | `PATCH` `{ title, description }` | 200 with new values; DB row updated; deadline unchanged | `server/tests/api/milestone-edit.api.test.ts` › TEST-05-01 |
| TEST-05-02 | AC-05-02 | API + DB | Milestone on Alpha | `PATCH` deadline +1 day later; then same deadline; then a past-deadline milestone extended | 200 each; DB deadline = sent value | same file › TEST-05-02 |
| TEST-05-03 | AC-05-03 | API + DB | Milestone on Alpha | `PATCH` `{ title: "Changed", deadline: stored − 1 ms }` | 409 `DEADLINE_NOT_EXTENDED`; DB title and deadline unchanged | same file › TEST-05-03 |
| TEST-05-04 | AC-05-04 | API + DB | student1, supervisor2, supervisor1 tokens; no token | `PATCH` as each; unknown ID; `abc` | 403 / 404 / 404 / 404 / 401; DB unchanged; supervisor1 200 (positive control) | same file › TEST-05-04 |
| TEST-05-05 | AC-05-05 | API + DB | supervisor1 token | `PATCH` each invalid body | 400 with expected `details`; DB unchanged; 120-char title 200 | same file › TEST-05-05 |
| TEST-05-06 | AC-05-06 | API + DB | Milestone with deadline 2 days ago; student1 submits v1 | Extend deadline to +3 days; student1 submits v2 | v1 `daysLate` still 2; v2 `daysLate` 0 | same file › TEST-05-06 |
| TEST-05-07 | AC-05-07 | Integration | Milestone with deadline +1 day | Two parallel `PATCH` (+5 d, +3 d) | Stored deadline = +5 d; at least one 200; any other response is 409 | same file › TEST-05-07 |
| TEST-05-08 | AC-05-05 | Unit | — | `validateMilestoneUpdate` boundaries | 120 ok / 121 `TOO_LONG`; blank `REQUIRED`; `""` description → `null`; invalid date `INVALID_DATE`; `{}` → `body: NO_CHANGES`; wrong types `INVALID_TYPE` | `server/tests/unit/milestone-update-validation.test.ts` |
| TEST-05-09 | AC-05-08 | UI | Mocked API: supervisor, milestone, no submissions | Edit title + deadline on `/supervisor/milestones/10`, save | PATCH body has only `title` and `deadline`; card shows new title and ICT deadline | `client/tests/MilestoneEdit.test.tsx` › TEST-05-09 |
| TEST-05-10 | AC-05-09 | UI | Mocked API returns 409, then 400 details | Save | Alert "The deadline can only be extended, not moved earlier"; "Required" under Title; old title still on the card | same file › TEST-05-10 |
| TEST-05-11 | AC-05-05 | API + DB | supervisor1 token; milestone on Alpha with deadline +1 day | `PATCH` `{ title: "Changed", deadline }` with `2027-02-30T12:00:00.000Z`, `2027-04-31T12:00:00Z`, `x 2030`, `05/06/2027`, `2027-05-05T10:00:00`; control `2028-02-29T12:00:00.000Z` | 400 `INVALID_DATE` and DB title and deadline unchanged for each invalid value; control 200 with that instant stored | `server/tests/api/deadline-format.api.test.ts` › TEST-05-11 |
| TEST-05-12 | AC-05-10 | UI | Mocked API: supervisor, milestone | Open Edit milestone, enter Deadline `20266-05-05T10:00`, Save | "Invalid date" under Deadline; no PATCH sent; card still shows the old deadline | `client/tests/DeadlineInput.test.tsx` › TEST-05-12 |

## 8. Definition of Done and evidence

- [x] All AC-05-01..AC-05-09 implemented
- [x] All STS tests executed and passing on a fresh test database — on `fdfdff4`: `npm run build` OK; `npm test` server 96 passed (F-05: 7 API + 5 unit), client 19 passed (F-05: 2), 0 failed, 0 skipped; `npm run test:e2e` 4 passed; `python -m unittest discover -s deploy/tests` 17 OK. CI `test-and-docker`: recorded on the PR
- [x] TDD red → green: failing tests `931814a` (F-05 files only: server 12 failed — 7 API with 404 because the route did not exist, 5 unit with `validateMilestoneUpdate is not a function`; client 2 failed — no "Edit milestone" button) → implementation `fdfdff4` (all pass). TEST-05-06 was corrected before the test commit: its first version set the deadline exactly 2 days back, so the late version counted 3 days (BR-05 rounds up) and failed for the wrong reason
- [x] SRS BR-13 (v0.6), System SDS §3.1 / §4 / §4.2 / §5 (v0.6), `docs/traceability.md` (v1.5), `docs/features.md` (v1.0) updated
- [ ] PR reviewed by phet526 (approve before merge) and merged into `sprint-2`

### 8.1 Defect #94 group A (`DEF-DEADLINE`, v0.5)

- [ ] Contract v0.5 committed before the tests
- [ ] RED: TEST-05-11, TEST-05-12 fail on the pre-fix code for the reported behaviour
- [ ] GREEN: the same tests pass; full regression passes
- [ ] PR reviewed by phet526 (approve before merge) and merged into `sprint-3`
