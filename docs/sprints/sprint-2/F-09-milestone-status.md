# F-09 Derived Team Milestone Status — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-09): contract`), then the failing
> tests (`test(F-09): ...`), then the implementation (`feat(F-09): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-21 | phet526 | Initial contract for F-09 (issue #67), incorporating the team decision on BR-05 rev. / CHG-03 |
| 0.2 | 2026-11-21 | phet526 | Definition of Done filled with executed RED/GREEN and regression results (#67) |

## 1. Linked requirements

- **FR:** FR-20 (the system shows a derived status for each team–milestone pair)
- **BR:** BR-12 (derived status rules and precedence), BR-05 rev. / CHG-03 (#59, 7-day late window), BR-09 (feedback bound to one version), BR-13 (deadline extension moves the deadline/window), BR-01 (student own-team scope), BR-02 (supervisor assigned-team scope)
- **NFR:** NFR-02 (401 on milestone endpoints), NFR-03 (404/403 access enforcement unchanged), NFR-10 (single-query list loading, no N+1, prepares Sprint 3 performance)
- **Decisions:** D-04 (assigned supervisors), Issue #67 Option A agreement (2026-11-21: keep the 5 statuses in `BR-12`; **Overdue** covers both the 7-day late window and after it closes)

## 2. Feature-level design

### 2.1 Derived status rules and precedence

Every team–milestone status is **derived at request time** against the current server time (`now`) and is **never stored** in PostgreSQL. It is evaluated in this exact order; the **first matching condition wins**:

1. **`Reviewed`**: the milestone has at least one submission, and the **latest** submission version has `feedbackCount >= 1`.
2. **`Submitted late`**: the milestone has at least one submission, the latest submission version has `daysLate > 0` and `feedbackCount === 0`.
3. **`Submitted`**: the milestone has at least one submission, the latest submission version has `daysLate === 0` and `feedbackCount === 0`.
4. **`Overdue`**: the milestone has **no** submissions and `now > deadline`.
5. **`Not submitted`**: the milestone has **no** submissions and `now <= deadline` (exact boundary `now === deadline` is `Not submitted`, matching BR-05).

### 2.2 Interactions with Sprint 1 and Sprint 2 rules

- **Latest version wins (BR-06, BR-09):** Status tracks only the **latest** submission version (`max(version)`). Resubmitting after supervisor feedback transitions status back to `Submitted` (`daysLate = 0`) or `Submitted late` (`daysLate > 0`) until feedback is recorded on that new version.
- **BR-05 rev. / CHG-03 (7-day late window, #59 — Option A decision in #67):**
  - **Overdue** covers any milestone with no submissions once `now > deadline` — both inside the 7-day late window (`deadline < now <= deadline + 7 × 24 h`) and after the late window closes (`now > deadline + 7 × 24 h`), rather than introducing a 6th status. On `/student/milestones/:id`, the student already sees the closed-window notice from CHG-03.
- **F-05 (`BR-13`) deadline extension:**
  - Extending an **Overdue** milestone's deadline to a new deadline `>= now` moves `now <= deadline`, returning its status to **Not submitted**.
  - Extending an **Overdue** (> 7 days) milestone's deadline to a past timestamp inside the new 7-day window (`newDeadline < now`) reopens submissions under BR-05 rev., while its derived status stays **Overdue** until a submission is created.
  - Stored `daysLate` of earlier submissions does not change when a deadline is extended (BR-13).
- **F-08 (Grades):** Grades are shown separately and do not alter derived status.

### 2.3 Backend and query design (No N+1)

- **Pure helper (`server/src/utils/validation.ts`):** `deriveMilestoneStatus({ deadline, now, latestSubmission })` takes `{ deadline: Date, now: Date, latestSubmission: { daysLate: number; feedbackCount: number } | null }` and returns `"Not submitted" | "Overdue" | "Submitted" | "Submitted late" | "Reviewed"`.
- **Single-query persistence read (`server/src/services/teams.service.ts`):** `milestoneInclude` loads `submissions` with `orderBy: { version: "desc" }, take: 1, select: { version: true, daysLate: true, _count: { select: { feedback: true } } }` inside the existing Prisma `findMany` / `findFirst` / `create` / `update` queries (no per-milestone N+1 queries).
- **Consistent across list and detail:** `listMilestones`, `getMilestone`, `createMilestone`, `createMilestoneForTeams`, and `updateMilestone` all serialize via `toMilestoneDto(m, now)` so list (`GET /api/teams/:teamId/milestones`) and detail (`GET /api/milestones/:milestoneId`) never disagree. In `listMilestones`, one `now = new Date()` is captured for all items in the response.

### 2.4 Layers that need no change

- **Database schema & migrations:** No change (status is never stored).
- **Authentication & access control:** Endpoint URLs and 401/403/404 rules from F-02, F-05, F-06 remain identical.
- **Submission & feedback pages (`StudentMilestone`, `SupervisorMilestone`):** Left untouched to preserve Sprint 1 flows and keep separation from F-08 grade work; the status badge appears on the shared milestone list component (`MilestoneList`) used by **My team** and **Supervisor team detail**.

## 3. UI specification

| Screen | Route | Change | States |
|---|---|---|---|
| My team (Student) | `/student` | `MilestoneList` displays the server-derived `status` badge next to each milestone title | Uses existing `.badge` palette in `client/src/theme.css`: `Reviewed` → `.badge-success`, `Submitted` → `.badge`, `Submitted late` → `.badge-warning`, `Overdue` → `.badge-danger`, `Not submitted` → `.badge-neutral` |
| Supervisor team detail | `/supervisor/teams/:teamId` | `MilestoneList` displays the server-derived `status` badge next to each milestone title (newly created milestones include `status`) | Same badge mapping; list access/empty/error states unchanged; no inline styles |

## 4. API specification

No new endpoints. Existing milestone endpoints add `status: MilestoneStatus` (`"Not submitted" | "Overdue" | "Submitted" | "Submitted late" | "Reviewed"`) to every serialized `Milestone` object:

- `GET /api/teams/:teamId/milestones` → `200 { milestones: Milestone[] }` (each with `status`)
- `GET /api/milestones/:milestoneId` → `200 { milestone: Milestone }` (with `status`)
- `POST /api/teams/:teamId/milestones` → `201 { milestone: Milestone }` (with `status: "Not submitted"`)
- `POST /api/milestones` → `201 { milestones: Milestone[] }` (each with `status: "Not submitted"`)
- `PATCH /api/milestones/:milestoneId` → `200 { milestone: Milestone }` (with re-evaluated `status`)

Example `Milestone` object (`200`):

```json
{
  "id": 10,
  "teamId": 1,
  "title": "SRS draft",
  "description": "First version",
  "deadline": "2026-11-25T16:59:00.000Z",
  "createdAt": "2026-11-21T03:00:00.000Z",
  "createdBy": { "id": 7, "name": "Supervisor One" },
  "status": "Submitted late"
}
```

## 5. Data specification

No schema change and no migration. Uses existing `Milestone.deadline`, `Submission.version`, `Submission.daysLate`, and `Feedback` count.

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-09-01 | **Given** a milestone with no submissions, **when** `now <= deadline` (including `now === deadline`), **then** `status` is `"Not submitted"`; **when** `now > deadline` (both inside the 7-day late window and when `now > deadline + 7 × 24 h`), **then** `status` is `"Overdue"`, and `GET /api/teams/:teamId/milestones` and `GET /api/milestones/:milestoneId` agree. |
| AC-09-02 | **Given** a milestone with submissions, **when** the latest version has `daysLate === 0` and no feedback, **then** `status` is `"Submitted"`; **when** the latest version has `daysLate > 0` and no feedback, **then** `status` is `"Submitted late"`. |
| AC-09-03 | **Given** a milestone whose latest submission has ≥ 1 feedback, **when** queried, **then** `status` is `"Reviewed"`; **when** the student submits a newer version after that feedback, **then** `status` returns to `"Submitted"` or `"Submitted late"` until the new version receives feedback. |
| AC-09-04 | **Given** a milestone in `"Overdue"` (> 7 days past deadline, no submissions), **when** an assigned supervisor extends its deadline to `newDeadline >= now` (`PATCH /api/milestones/:id`, BR-13), **then** its derived `status` transitions back to `"Not submitted"` on both list and detail endpoints. |
| AC-09-05 | **Given** `POST /api/teams/:teamId/milestones`, `POST /api/milestones` (F-06), or `PATCH /api/milestones/:id` (F-05), **when** a milestone is created or updated, **then** the response returns its derived `status`, matching subsequent `GET` reads. |
| AC-09-06 | **Given** out-of-scope or unauthenticated callers on list or detail milestone endpoints, **when** requesting milestone status, **then** Team Beta student / unassigned supervisor receive `404 NOT_FOUND` with no data and missing token receives `401 UNAUTHENTICATED`. |
| AC-09-07 | **Given** a student on `/student` or a supervisor on `/supervisor/teams/:teamId`, **when** milestones are listed, **then** each milestone shows its derived status badge (`Not submitted`, `Overdue`, `Submitted`, `Submitted late`, `Reviewed`). |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| `TEST-09-01` | AC-09-01 | API + DB | Team Alpha milestones with no submissions: future deadline, past deadline (2 d ago), and closed-window deadline (10 d ago, CHG-03) | `GET /api/teams/:id/milestones` and `GET /api/milestones/:milestoneId` as student1 & supervisor1 | Future → `"Not submitted"`, 2 d past → `"Overdue"`, 10 d past (> 7 d closed window) → `"Overdue"`; list and detail return identical `status` | `server/tests/api/milestone-status.api.test.ts` › TEST-09-01 |
| `TEST-09-02` | AC-09-02, AC-09-03 | API + DB | Team Alpha milestone starting `"Not submitted"` | Submit v1 on time → feedback on v1 → resubmit v2 late (`daysLate > 0`) → feedback on v2; query list & detail after each step | Transitions `"Not submitted"` → `"Submitted"` → `"Reviewed"` → `"Submitted late"` → `"Reviewed"`; list and detail agree at every step | same file › TEST-09-02 |
| `TEST-09-03` | AC-09-04 | API + DB | Team Alpha milestone 10 d past deadline (`"Overdue"`, CHG-03 closed) | Verify `"Overdue"`, then supervisor1 `PATCH /api/milestones/:id` to `now + 3 d`, then read list & detail | `PATCH` returns `200` with `status: "Not submitted"`; list and detail both return `"Not submitted"` | same file › TEST-09-03 |
| `TEST-09-04` | AC-09-05 | API + DB | Seeded; supervisor1 token | `POST /api/teams/:alpha/milestones`, `POST /api/milestones` (`[Alpha, Beta]`), `PATCH /api/milestones/:id` | Create responses return `status: "Not submitted"`; edit returns updated `status`, matching `GET /api/milestones/:id` | same file › TEST-09-04 |
| `TEST-09-05` | AC-09-06 | API + DB | Team Alpha milestone; student3, supervisor2, no token; positive controls student1, supervisor1 | `GET /api/teams/:alpha/milestones` & `GET /api/milestones/:id` | `404 NOT_FOUND` (no milestone data) for student3 & supervisor2; `401 UNAUTHENTICATED` without token; `200` with `status` for positive controls | same file › TEST-09-05 |
| `TEST-09-06` | AC-09-01..04 | Unit | Pure helper `deriveMilestoneStatus` (`server/src/utils/validation.ts`) | Test all 5 statuses, `now === deadline`, `now === deadline + 1 ms`, `now > deadline + 7 d`, resubmission after feedback, and BR-13 deadline extension to future vs past `< now` | Exact status matches rules & precedence at every boundary | `server/tests/unit/milestone-status.test.ts` › TEST-09-06 |
| `TEST-09-07` | AC-09-07 | UI | Mocked API: student1; Team Alpha with 5 milestones covering all 5 statuses | Render `/student` | All 5 status badges (`Not submitted`, `Overdue`, `Submitted`, `Submitted late`, `Reviewed`) displayed beside their milestone titles | `client/tests/MilestoneStatus.test.tsx` › TEST-09-07 |
| `TEST-09-08` | AC-09-07 | UI | Mocked API: supervisor1; Team Alpha milestones + create new milestone returning `status: "Not submitted"` | Render `/supervisor/teams/1`, check existing badges, submit New milestone form | Existing status badges shown; created milestone displays `"Not submitted"` badge in the list | same file › TEST-09-08 |

## 8. Definition of Done and evidence

- [x] All AC-09-01..AC-09-07 implemented
- [x] All STS tests executed and passing on a fresh test database — on `31949c8`: `npm run build` OK; `npm test` server **114 passed** (16 files; F-09: 5 API + 1 unit), client **25 passed** (8 files; F-09: 2), 0 failed, 0 skipped; `npm run test:e2e` **4 passed**; `python -m unittest discover -s deploy/tests` **17 OK**
- [x] TDD red → green evidence recorded — contract `62522ec` → RED `f9eab65` (build OK; server **6 failed / 108 passed**: `TEST-09-01..05` returned `status: undefined`, `TEST-09-06` `deriveMilestoneStatus is not a function`; client **2 failed / 23 passed**: `TEST-09-07/08` status badges missing) → GREEN `31949c8` (all pass; existing Sprint 1/2 tests unchanged)
- [x] SRS (`BR-12`, v0.9), System SDS (`docs/system-sds.md` v0.10), `docs/traceability.md` (v2.1), `docs/features.md` (v1.5), and `docs/ai-use.md` updated
- [ ] PR reviewed by ILoveSiesta (approve before merge) and merged into `sprint-2`
