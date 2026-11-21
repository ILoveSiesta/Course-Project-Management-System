# F-07 Milestone Revision History — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-07): contract`), then the failing
> tests (`test(F-07): ...`), then the implementation (`feat(F-07): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-21 | phet526 | Initial contract for F-07 (issue #64) |
| 0.2 | 2026-11-21 | phet526 | Definition of Done filled with executed RED/GREEN and regression results (#64) |

## 1. Linked requirements

- **FR:** FR-15 (users can view the full revision history of a team's milestone: all versions with their feedback)
- **BR:** BR-06 (sequential, unique versions; earlier versions never overwritten or deleted), BR-09 (feedback belongs to one submission version, append-only; later resubmissions do not move, change, or remove feedback on earlier versions), BR-01 (student scope: own team only), BR-02 (supervisor scope: assigned teams only)
- **NFR:** NFR-02 (401 on the new protected endpoint), NFR-03 (404 without data for out-of-scope users), NFR-05 (safe JSON error shape)
- **Decisions:** D-04 (any assigned supervisor may view), D-08 (append-only feedback per version)

## 2. Feature-level design

### 2.1 What F-07 adds beyond Sprint 1 (F-03 / F-04)

The Sprint 1 milestone pages (`StudentMilestone`, `SupervisorMilestone`, `SubmissionList`, `FeedbackSection`) already list submissions (`GET /api/milestones/:milestoneId/submissions`) with nested feedback in ascending version order. F-07 adds a dedicated **revision history** capability rather than relabelling that list:

1. **Dedicated read-only history endpoint (`GET /api/milestones/:milestoneId/history?order=desc|asc`):**
   - Loads the milestone (with `teamName`), all submission versions, and each version's feedback in **one Prisma query** (no N+1, no extra client round-trip to stitch milestone + submissions).
   - Computes server-derived revision metadata in `server/src/utils/submissionValidation.ts` (`parseHistoryOrder`, `buildRevisionHistory`): `totalVersions`, `latestVersion` (`null` when no submissions exist), per-version `isLatest` boolean marker, `isLate` (`daysLate > 0`), and `feedbackCount`.
   - Supports explicit ordering via `?order=desc` (default: newest version first for quick review) and `?order=asc` (chronological `v1 → v2 → v3`). Feedback entries inside each version stay chronological (`createdAt asc, id asc`).
2. **Dedicated Revision History screen (`/student/milestones/:milestoneId/history` and `/supervisor/milestones/:milestoneId/history`):**
   - Linked from both `StudentMilestone` and `SupervisorMilestone` (`View revision history`).
   - Displays milestone context (`title`, `teamName`, `deadline`, `Total versions: N / 3`), an ordering toggle (`Newest first` / `Oldest first`), a **`Latest`** badge on the newest version, on-time/late status badge, submitter and timestamp, and each version's feedback count, comments, authors, and timestamps.
   - Read-only view (no submit or feedback forms), keeping full history inspection separate from submission/review actions.
3. **Layers that need no change:**
   - **Database schema & migrations:** No change (`Milestone`, `Team`, `Submission`, `Feedback` already persist all required data).
   - **Existing Sprint 1 endpoints & UI components:** `GET /api/milestones/:milestoneId/submissions`, `SubmissionList`, and `FeedbackSection` stay unchanged so all Sprint 1 contracts and tests remain unaffected.

### 2.2 Business rules, check order, and boundaries

- **Access and check order** (System SDS §4): authenticate (`401 UNAUTHENTICATED`) → milestone ID parse & record scope (`404 NOT_FOUND`, no disclosure) → query validation (`400 VALIDATION_ERROR`, `{ order: "INVALID_ORDER" }`).
  - Scope is checked **before** `order` validation so probing an out-of-scope milestone ID with an invalid `order` still returns `404` and never reveals whether the milestone exists.
- **Query parameter `order`:**
  - Omitted or `"desc"` → newest version first (`version` descending).
  - `"asc"` → oldest version first (`version` ascending).
  - Any other value (including empty string `""`, `"ASC"`, `"latest"`) → `400 VALIDATION_ERROR` with `details: { order: "INVALID_ORDER" }`.
- **Immutability across resubmissions (BR-06, BR-09):**
  - Resubmitting a new version (`v2`, `v3`) never modifies earlier versions' fields (`title`, `description`, `link`, `submittedAt`, `daysLate`) or their recorded feedback; `isLatest` shifts to the newest version while earlier versions retain `isLatest: false` and their exact feedback entries.
- **Boundary cases:**
  - `0` submissions → `200` with `totalVersions: 0`, `latestVersion: null`, `revisions: []`.
  - `1` submission → `totalVersions: 1`, `latestVersion: 1`, single entry has `isLatest: true`.
  - `3` submissions (BR-07 max) → `totalVersions: 3`, `latestVersion: 3`, only `version === 3` has `isLatest: true`.
- **Dependencies:** F-01 (`authenticate`), F-02 (`scopeFilter`, milestone lookup), F-03 (`Submission` model & `daysLate`), F-04 (`Feedback` model, `feedbackInclude`, `toFeedbackDto`).

## 3. UI specification

| Screen | Route | Change | States |
|---|---|---|---|
| Revision history (Student / Supervisor) | `/student/milestones/:milestoneId/history`<br/>`/supervisor/milestones/:milestoneId/history` | New read-only `RevisionHistory` component: back link (`← Back to milestone`), milestone header card (`title`, `teamName`, `Due: <ICT time>`, `Total versions: N / 3`), order toggle buttons (`Newest first`, `Oldest first`), and ordered revision list showing `Version N: <title>`, `Latest` badge (when `isLatest`), `On time` / `Late (+N d)` badge, submitter + ICT timestamp, description, link, `Feedback (K)` with author + ICT timestamp per entry (or `No feedback on this version.`) | Loading (`Loading…`); empty (`No submissions in revision history yet.`); `404` (`Milestone not found or not allowed`, no partial data); `401` (logout → `/login`) |
| Student milestone detail | `/student/milestones/:milestoneId` | Add link `View revision history` to `/student/milestones/:milestoneId/history` in the milestone header card | Unchanged |
| Supervisor milestone detail | `/supervisor/milestones/:milestoneId` | Add link `View revision history` to `/supervisor/milestones/:milestoneId/history` in the milestone header card | Unchanged |

- Styling uses shared classes in `client/src/theme.css` (`card`, `badge`, `badge-success`, `badge-warning`, `plain-list`, `submission-item`, `submission-header`, `feedback-section`, `feedback-list`, `feedback-item`, `feedback-comment`, `feedback-meta`, `btn`, `btn-secondary`, `alert`, `empty-state`, `muted`) plus `.history-toolbar`, `.history-badges`, and `.badge-primary` rules; no inline styles.

## 4. API specification

All responses use the JSON error shape from System SDS §4. IDs are integers; timestamps are ISO 8601 UTC strings.

| Method | Path | Auth / role | Query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/api/milestones/:milestoneId/history` | Student (own team) or Supervisor (assigned team) | `order?: "desc" \| "asc"` (default `"desc"`) | `200 { history: MilestoneRevisionHistory }` | `401`, `404`, `400` |

Success response shape (`200`):

```json
{
  "history": {
    "milestone": {
      "id": 10,
      "teamId": 1,
      "teamName": "Team Alpha",
      "title": "SRS draft",
      "description": "First version",
      "deadline": "2026-11-08T16:59:00.000Z"
    },
    "totalVersions": 2,
    "latestVersion": 2,
    "revisions": [
      {
        "id": 102,
        "version": 2,
        "isLatest": true,
        "title": "SRS draft v2",
        "description": "Fixed scope",
        "link": "https://github.com/my-team/repo/pull/2",
        "submittedAt": "2026-11-09T10:00:00.000Z",
        "daysLate": 1,
        "isLate": true,
        "submittedBy": { "id": 1, "name": "Student One" },
        "feedbackCount": 0,
        "feedback": []
      },
      {
        "id": 101,
        "version": 1,
        "isLatest": false,
        "title": "SRS draft v1",
        "description": "Initial",
        "link": "https://github.com/my-team/repo/pull/1",
        "submittedAt": "2026-11-08T10:00:00.000Z",
        "daysLate": 0,
        "isLate": false,
        "submittedBy": { "id": 1, "name": "Student One" },
        "feedbackCount": 1,
        "feedback": [
          {
            "id": 201,
            "submissionId": 101,
            "comment": "Clarify BR-05",
            "createdAt": "2026-11-08T12:00:00.000Z",
            "author": { "id": 7, "name": "Supervisor One" }
          }
        ]
      }
    ]
  }
}
```

Invalid `order` error (`400`, only after scope succeeds):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid sort order", "details": { "order": "INVALID_ORDER" } } }
```

## 5. Data specification

No schema change and no migration. The query reads existing `Milestone`, `Team`, `Submission`, `User`, and `Feedback` tables in a single Prisma `findFirst` call with nested `include`.

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-07-01 | **Given** a milestone on Team Alpha with 2 submission versions where v1 has 2 feedback entries and v2 has 0 feedback, **when** student1 (Team Alpha) or supervisor1 (assigned to Team Alpha) calls `GET /api/milestones/:id/history`, **then** return `200` with `milestone` metadata (`teamName: "Team Alpha"`), `totalVersions: 2`, `latestVersion: 2`, revisions ordered `v2` then `v1` (`desc` default), `isLatest: true` only on `v2`, `isLate` / `daysLate`, submitter + timestamp, and chronological feedback with author and timestamp on `v1`; calling with `?order=asc` returns `v1` then `v2`. |
| AC-07-02 | **Given** a milestone where v1 received feedback before v2 was submitted and v2 received feedback before v3 was submitted, **when** revision history is fetched, **then** v1 and v2 keep their original metadata and feedback unchanged (BR-06, BR-09) while `latestVersion` is `3` and only v3 has `isLatest: true`. |
| AC-07-03 | **Given** a milestone in scope with no submissions, **when** `GET /api/milestones/:id/history` is called, **then** return `200` with `totalVersions: 0`, `latestVersion: null`, and `revisions: []`. |
| AC-07-04 | **Given** a milestone on Team Alpha, **when** student3 (Team Beta), supervisor2 (unassigned to Alpha), or a request for unknown/non-numeric ID calls `GET /api/milestones/:id/history`, **then** return `404 NOT_FOUND` with no milestone or submission data; **when** called without a token, **then** return `401 UNAUTHENTICATED`. |
| AC-07-05 | **Given** an invalid `order` query parameter (e.g. `?order=invalid`), **when** called on an in-scope milestone, **then** return `400 VALIDATION_ERROR` with `details: { order: "INVALID_ORDER" }`; **when** called on an out-of-scope milestone, **then** return `404 NOT_FOUND` (scope checked before validation). |
| AC-07-06 | **Given** a student on `/student/milestones/:id/history` for a milestone with 2 versions (v1 with feedback, v2 without), **when** the page loads, **then** it displays milestone context, `Total versions: 2 / 3`, `Latest` badge only on v2, late/on-time badges, submitter and time, feedback author and time on v1, `"No feedback on this version."` on v2, and clicking **Oldest first** re-fetches `?order=asc` and renders v1 before v2; `StudentMilestone` includes a link to this page. |
| AC-07-07 | **Given** a supervisor on `/supervisor/milestones/:id/history`, **when** the milestone has no submissions, **then** display `"No submissions in revision history yet."`; **when** the API returns `404`, **then** display `"Milestone not found or not allowed"` with no partial data. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| `TEST-07-01` | AC-07-01 | API + DB | Seeded; Team Alpha milestone with v1 (on time, 2 feedback entries) and v2 (late, 0 feedback) | `GET /api/milestones/:id/history` (default) and `?order=asc` as student1 and supervisor1 | `200`; `totalVersions: 2`, `latestVersion: 2`; `desc` returns `[v2, v1]`, `asc` returns `[v1, v2]`; `isLatest` true only on v2; `isLate`, `daysLate`, submitter, `feedbackCount`, author and timestamps match | `server/tests/api/revision-history.api.test.ts` › TEST-07-01 |
| `TEST-07-02` | AC-07-02 | API + DB | Team Alpha milestone: submit v1 → add feedback on v1 → submit v2 → add feedback on v2 → submit v3 | `GET /api/milestones/:id/history?order=asc` as student1 | `totalVersions: 3`, `latestVersion: 3`; v1 and v2 retain original title/link/daysLate/feedback unchanged; only v3 has `isLatest: true` | same file › TEST-07-02 |
| `TEST-07-03` | AC-07-03 | API + DB | Team Alpha milestone with 0 submissions | `GET /api/milestones/:id/history` as student1 | `200`; `totalVersions: 0`, `latestVersion: null`, `revisions: []` | same file › TEST-07-03 |
| `TEST-07-04` | AC-07-04 | API + DB | Team Alpha milestone; student3, supervisor2, no token, unknown ID `999999`, non-numeric `abc`; positive controls student1 & supervisor1 | `GET /api/milestones/:id/history` | `404 NOT_FOUND` (no `history` field) for student3, supervisor2, unknown, non-numeric; `401 UNAUTHENTICATED` without token; `200` for student1 & supervisor1 | same file › TEST-07-04 |
| `TEST-07-05` | AC-07-05 | API + DB | Team Alpha milestone (in scope for student1, out of scope for student3) | `?order=invalid` and `?order=` as student1; `?order=invalid` as student3; `?order=asc` as student1 (positive control) | `400 VALIDATION_ERROR` `{ order: "INVALID_ORDER" }` in scope; `404 NOT_FOUND` out of scope; `200` for positive control | same file › TEST-07-05 |
| `TEST-07-06` | AC-07-01, AC-07-03, AC-07-05 | Unit | Pure helpers `parseHistoryOrder` & `buildRevisionHistory` (`server/src/utils/submissionValidation.ts`) | Valid/invalid order values; 0, 1, and 2 submissions in `desc` and `asc` order | Parses `undefined`/`"desc"`/`"asc"`, rejects invalid with `400 INVALID_ORDER`; computes `totalVersions`, `latestVersion`, `isLatest`, `isLate`, `feedbackCount`, and ordering accurately | `server/tests/unit/revision-history.test.ts` › TEST-07-06 |
| `TEST-07-07` | AC-07-06 | UI | Mocked API: student1; milestone 10 with 2 versions (v1 with feedback, v2 without) | Render `/student/milestones/10/history`, inspect default `desc` view, click `Oldest first`; also render `/student/milestones/10` | Shows team name, `Total versions: 2 / 3`, `Latest` badge only on v2, feedback author/time on v1, empty feedback note on v2; clicking `Oldest first` requests `?order=asc` and lists v1 before v2; detail page has `View revision history` link | `client/tests/RevisionHistory.test.tsx` › TEST-07-07 |
| `TEST-07-08` | AC-07-07 | UI | Mocked API: supervisor1; empty history, then 404 | Render `/supervisor/milestones/10/history` | Empty state shows `"No submissions in revision history yet."`; 404 shows `"Milestone not found or not allowed"` alert with no partial data | same file › TEST-07-08 |

## 8. Definition of Done and evidence

- [x] All AC-07-01..AC-07-07 implemented
- [x] All STS tests executed and passing on a fresh test database — on `9751f0f`: `npm run build` OK; `npm test` server **114 passed** (16 files; F-07: 5 API + 1 unit), client **25 passed** (8 files; F-07: 2), 0 failed, 0 skipped; `npm run test:e2e` **4 passed**; `python -m unittest discover -s deploy/tests` **17 OK**
- [x] TDD red → green evidence recorded — contract `7b80e0c` → RED `38f7515` (build OK; server **6 failed / 108 passed**: `TEST-07-01..05` returned `404` because `GET /api/milestones/:milestoneId/history` did not exist yet, `TEST-07-06` `parseHistoryOrder is not a function`; client **2 failed / 23 passed**: `TEST-07-07/08` route/screen missing) → GREEN `9751f0f` (all pass; existing Sprint 1 tests unchanged)
- [x] System SDS (`docs/system-sds.md` v0.9), `docs/traceability.md` (v1.10), `docs/features.md` (v1.4), and `docs/ai-use.md` updated
- [ ] PR reviewed by ILoveSiesta (approve before merge) and merged into `sprint-2`
