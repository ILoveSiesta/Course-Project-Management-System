# F-12 Submission Filtering — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-12): contract`), then the failing
> tests (`test(F-12): ...`), then the implementation (`feat(F-12): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.
>
> **Status (v0.1):** contract only, written in #84 before the Deliverable 2 checkpoint (D2 §3.3). Implementation
> follows after Deliverable 2 in its own Issue (contract → RED → GREEN); until then every test below is PLANNED.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-22 | ILoveSiesta | Initial contract for F-12 (#84) |

## 1. Linked requirements

- **FR:** FR-23 (a supervisor can filter the submission list by team, milestone and status)
- **BR:** BR-02 (assigned teams only), BR-03 (supervisor-only operation), BR-12 (status vocabulary), BR-09 (feedback bound to one version), BR-06 (versions kept)
- **NFR:** NFR-02, NFR-03 (filters cannot widen access), NFR-05 (error shape), NFR-10 (unfiltered list inside the Sprint 3 response-time check, see F-11 §2.4), NFR-11, NFR-12 (the UI explains a rejected filter)
- **Decisions:** D-04

## 2. Feature-level design

### 2.1 Behaviour and workflow

- Today a supervisor sees submissions only per milestone (`GET /api/milestones/:id/submissions`). F-12 adds one cross-team list of **submission versions** for all assigned teams, `GET /api/submissions`, with three optional filters combined with AND: `teamId`, `milestoneId`, `status`.
- Rows are sorted by `submittedAt` descending (newest first), then `id` descending. Every version is a row; `isLatest` marks the latest version of its milestone.
- **Version status** (the BR-12 vocabulary applied to one version, first match wins): `Reviewed` (the version has ≥ 1 feedback) → `Submitted late` (`daysLate > 0`) → `Submitted`. `Overdue` and `Not submitted` describe milestones without a submission, so they are not valid values for this list.
- The screen `/supervisor/submissions` has three selects (Team, Milestone, Status) whose values are kept in the URL query string, so a reload or a shared link keeps the filters.
- No pagination in Sprint 3: the NFR-10 dataset (600 versions) is measured unfiltered; if lists grow beyond that, pagination is recorded as technical debt.

### 2.2 Validation and check order

Check order (same precedent as F-06: request format before scope): `401` → `403` → `400` format → `404` scope.

| Parameter | Valid values | Invalid → |
|---|---|---|
| `teamId` | positive integer | `400 INVALID_FILTER` ("teamId must be a positive integer") |
| `milestoneId` | positive integer | `400 INVALID_FILTER` |
| `status` | exactly `Submitted`, `Submitted late` or `Reviewed` | `400 INVALID_FILTER` ("status must be one of: Submitted, Submitted late, Reviewed") — includes `Overdue` and `Not submitted` |

- Unknown parameters are ignored. A parameter given twice is invalid (`400 INVALID_FILTER`).
- **Scope:** a `teamId` that does not exist or is not assigned to the caller → `404 NOT_FOUND`; a `milestoneId` that does not exist or belongs to an unassigned team → `404 NOT_FOUND` (no disclosure, as in F-02).
- A valid in-scope `teamId` with an in-scope `milestoneId` of a different team → `200` with `submissions: []` (both filters are allowed; the combination matches nothing).
- Without `teamId`/`milestoneId`, the list is always limited to assigned teams: a filter can narrow the list but never widen it.

### 2.3 Permissions

| Caller | Result |
|---|---|
| No / invalid / logged-out token | `401 UNAUTHENTICATED` |
| Student | `403 FORBIDDEN` (`requireRole("SUPERVISOR")`), no data |
| Supervisor | `200`, versions of assigned teams only |

### 2.4 Query design

One `submission.findMany` with `where: { milestone: { team: scopeFilter(user), teamId?, id? } }`, `include` milestone (id, title, deadline, team id/name), submitter (id, name), `_count.feedback`, ordered by `submittedAt desc, id desc`. `isLatest` comes from one grouped query of `max(version)` per milestone in the result (no per-row query). The status filter is applied in the `where` (`feedback: { some: {} }` / `none` plus `daysLate`), so the database returns only matching rows.

### 2.5 Dependencies and layers that need no change

- Depends on F-03 (submissions), F-04 (feedback count), F-09 (status vocabulary).
- **Database:** no schema change, no migration (existing index `Submission(milestoneId, submittedAt)`).
- **Existing endpoints and pages:** unchanged; the per-milestone submission list stays as it is.

## 3. UI specification

| Screen | Route | Content | States |
|---|---|---|---|
| Supervisor submissions | `/supervisor/submissions` (link "Submissions" on `/supervisor`) | Filter form: Team (All + assigned teams from `GET /api/teams`), Milestone (All + milestones of the selected team from `GET /api/teams/:id/milestones`; disabled until a team is chosen), Status (All, Submitted, Submitted late, Reviewed). Result list: one card per version with team, milestone title, "Version N" (+ "Latest"), submitter, submitted time (`formatDeadline`), late badge with days late, version status badge, feedback count, link to `/supervisor/milestones/:id` | Loading; error (`.alert` with the server message, for example an invalid status in a hand-edited URL; 401 → logout); empty result (`.empty-state` "No submissions match these filters."); no teams ("You are not assigned to any team yet.") |

- Changing a select updates the URL query (`?teamId=1&status=Reviewed`) and reloads the list; changing the team resets the milestone filter.
- Badges reuse the F-09 mapping; new classes in `client/src/theme.css` only; no inline styles. NFR-11: no horizontal page scrolling at 375 px and 1280 px.

## 4. API specification

| Method | Path | Auth / role | Request | Success response | Errors |
|---|---|---|---|---|---|
| GET | `/api/submissions` | Supervisor (assigned teams) | Query (all optional): `teamId`, `milestoneId`, `status` | `200 { submissions: SubmissionRow[] }` | `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `400 INVALID_FILTER`, `404 NOT_FOUND` |

```json
{
  "submissions": [
    {
      "id": 31,
      "version": 2,
      "isLatest": true,
      "title": "SRS draft v2",
      "link": "https://example.com/srs-v2",
      "submittedAt": "2026-12-03T02:10:00.000Z",
      "daysLate": 1,
      "submittedBy": { "id": 3, "name": "Student One" },
      "feedbackCount": 0,
      "status": "Submitted late",
      "team": { "id": 1, "name": "Team Alpha" },
      "milestone": { "id": 10, "title": "SRS draft", "deadline": "2026-12-02T16:59:00.000Z" }
    }
  ]
}
```

`GET /api/submissions/:submissionId` (F-03) is unchanged; the new list is on the collection path of the same router. Errors use `{ "error": { "code", "message" } }`.

## 5. Data specification

No schema change and no migration. Reads `Submission`, `Milestone`, `Team`, `SupervisorAssignment`, submitter `User` (id, name) and `Feedback` count.

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-12-01 | **Given** supervisor1 with versions in Team Alpha and Team Beta, **when** they request the list without filters, **then** every version of both teams is returned, newest first, with team, milestone, version, `isLatest`, submitter, `daysLate`, `feedbackCount` and version status, and no version of an unassigned team. |
| AC-12-02 | **Given** that data, **when** `teamId`, `milestoneId` and `status` are used alone and together, **then** only versions matching every given filter are returned (AND), and an in-scope team with a milestone of another team returns `200` with an empty list. |
| AC-12-03 | **Given** a version with feedback, a late version without feedback and an on-time version without feedback, **when** listed, **then** their `status` is `Reviewed`, `Submitted late` and `Submitted`; an earlier version keeps its own status after a newer version is submitted (BR-09). |
| AC-12-04 | **Given** `teamId=abc`, `milestoneId=0`, `status=Overdue` or `status=reviewed`, **when** requested, **then** `400 INVALID_FILTER` with a message naming the parameter and no `submissions` field. |
| AC-12-05 | **Given** supervisor2 (not assigned to Alpha), **when** they request `teamId=<Alpha>` or `milestoneId=<Alpha milestone>`, **then** `404 NOT_FOUND` with no data; without filters, no Alpha version appears; the same requests by supervisor1 succeed (positive control). |
| AC-12-06 | **Given** student1, **when** they call the list (with or without filters), **then** `403 FORBIDDEN` with no data; **given** no token, **then** `401 UNAUTHENTICATED`. |
| AC-12-07 | **Given** the submissions screen, **when** the supervisor chooses filters, **then** the URL query string holds them, the list reloads with only matching versions, a reload keeps the filters, an empty result shows "No submissions match these filters.", and a rejected filter shows the server's message (NFR-12). |
| AC-12-08 | **Given** viewport widths of 375 px and 1280 px, **when** the screen is shown, **then** filters and results have no horizontal page scrolling (NFR-11). |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-12-01 | AC-12-01 | API + DB | Alpha: milestone A v1, v2; Beta: milestone B v1; Gamma (not assigned to supervisor1): milestone C v1 | `GET /api/submissions` as supervisor1 | 3 rows (A v2, B v1, A v1 by `submittedAt` desc); A v2 `isLatest` true, A v1 false; no Gamma row; every field of §4 present | `server/tests/api/submission-filter.api.test.ts` › TEST-12-01 |
| TEST-12-02 | AC-12-02 | API + DB | Data of TEST-12-01 + feedback on A v1 | `?teamId=Alpha`, `?milestoneId=B`, `?status=Reviewed`, `?teamId=Alpha&status=Submitted`, `?teamId=Alpha&milestoneId=B` | Only matching rows each time; last request `200` with `[]` | same file › TEST-12-02 |
| TEST-12-03 | AC-12-03 | API + DB | Alpha milestone with v1 + feedback, v2 late (deadline passed), another milestone v1 on time | List as supervisor1 | v1 `Reviewed`, v2 `Submitted late`, on-time v1 `Submitted`; v1 stays `Reviewed` after v2 exists | same file › TEST-12-03 |
| TEST-12-04 | AC-12-04 | API + DB | supervisor1 | `?teamId=abc`, `?milestoneId=0`, `?status=Overdue`, `?status=Not%20submitted`, `?status=reviewed`, `?teamId=1&teamId=2` | `400 INVALID_FILTER` each time; message names the parameter; body has no `submissions` | same file › TEST-12-04 |
| TEST-12-05 | AC-12-05 | API + DB | Positive control: supervisor1 `?teamId=Alpha` `200`; supervisor2 | supervisor2: `?teamId=Alpha`, `?milestoneId=<Alpha milestone>`, `?teamId=999999`, no filter | `404 NOT_FOUND` for the first three without data; no filter → no Alpha row | same file › TEST-12-05 |
| TEST-12-06 | AC-12-06 | API + DB | Positive control supervisor1 `200`; student1; no token | `GET /api/submissions` and `?teamId=Alpha` | student1 `403 FORBIDDEN` without data; no token `401 UNAUTHENTICATED` | same file › TEST-12-06 |
| TEST-12-07 | AC-12-07 | UI | Mocked API: teams, milestones, list responses for each filter, an empty result and a `400 INVALID_FILTER` | Render `/supervisor/submissions?teamId=1`; change Status to Reviewed; then render with `?status=Overdue` | Team select preset from URL; URL becomes `?teamId=1&status=Reviewed` and only Reviewed rows show; empty-state text for `[]`; alert shows the 400 message | `client/tests/SubmissionFilter.test.tsx` › TEST-12-07 |
| TEST-12-08 | AC-12-08 | E2E | Seeded data; Playwright at 375 × 812 and 1280 × 800 | Log in as supervisor1, open `/supervisor/submissions`, apply a team filter | No horizontal page scrolling at both sizes; filtered rows visible | `e2e/sprint3-board-report.spec.ts` › TEST-12-08 |

## 8. Definition of Done and evidence

- [ ] All AC-12-01..AC-12-08 implemented
- [ ] All STS tests executed and passing on a fresh test database (command, commit and pass/fail/skip counts recorded here)
- [ ] TDD red → green evidence recorded (contract commit → RED commit with tests only → GREEN commit)
- [ ] Existing Sprint 1–2 tests (per-milestone submission list, feedback, revision history) still pass (none weakened or skipped)
- [ ] `docs/system-sds.md`, `docs/traceability.md`, `docs/features.md` and `docs/ai-use.md` updated
- [ ] PR reviewed by the teammate (approve before merge) and merged into `sprint-3`
