# F-11 Supervisor Summary Report — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-11): contract`), then the failing
> tests (`test(F-11): ...`), then the implementation (`feat(F-11): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.
>
> **Status (v0.1):** contract only, written in #84 before the Deliverable 2 checkpoint (D2 §3.3). Implementation
> follows after Deliverable 2 in its own Issue (contract → RED → GREEN); until then every test below is PLANNED.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-22 | ILoveSiesta | Initial contract for F-11 and the NFR-10 measurement plan (SR-05) (#84) |

## 1. Linked requirements

- **FR:** FR-22 (a supervisor views a summary report of assigned teams: counts of milestones by status, late submissions and the average released grade per team)
- **BR:** BR-12 (status counts use the derived status), BR-11 (only released grades count; unreleased scores stay hidden), BR-05 rev. / CHG-03 (late submissions are those with `daysLate > 0`), BR-02 (assigned teams only), BR-03 (supervisor-only operation)
- **NFR:** NFR-10 (p95 ≤ 500 ms for list and report endpoints on the specified dataset; this contract holds the measurement plan for SR-05), NFR-02, NFR-03, NFR-11
- **Decisions:** D-03 (scores are hidden until a supervisor releases them), D-04

## 2. Feature-level design

### 2.1 Behaviour and workflow

- One read-only endpoint `GET /api/reports/summary` returns one row per assigned team plus a totals row. A screen `/supervisor/report` shows them as a table.
- **Per team:**
  - `milestoneCount` — milestones of the team
  - `statusCounts` — number of the team's milestones in each BR-12 status (`Not submitted`, `Overdue`, `Submitted`, `Submitted late`, `Reviewed`); the five counts add up to `milestoneCount`
  - `lateSubmissions` — number of submission **versions** of the team with `daysLate > 0` (every late version counts, not only the latest)
  - `releasedGradeCount` and `averageReleasedGrade` — mean `Grade.score` over the team's milestones whose grades are released (`Milestone.gradesReleasedAt` not null), rounded to one decimal place (half up); `null` when the team has no released grade
- **Totals:** sums of the counts over all rows; `averageReleasedGrade` in totals is the mean over **all** released grades (not the mean of team means), `null` if none.
- Status uses `deriveMilestoneStatus` with one `now` per request, so the report agrees with F-09 lists and the F-10 board at the same moment.

### 2.2 Business rules, validation, failure and boundary cases

- No input other than the token; query parameters are ignored.
- An unreleased grade never changes `averageReleasedGrade` or `releasedGradeCount` (BR-11), even though the supervisor can see the score on the milestone page.
- A team without milestones appears with zeros and `averageReleasedGrade: null` (for example a team just created with F-13).
- A supervisor without assigned teams gets `200` with `teams: []` and totals of zero.
- Rounding: `average = round(sum / count, 1)` with half up, for example scores 70 and 85 → 77.5; 70, 80, 81 → 77.0.

### 2.3 Permissions

| Caller | Result |
|---|---|
| No / invalid / logged-out token | `401 UNAUTHENTICATED` |
| Student | `403 FORBIDDEN` (`requireRole("SUPERVISOR")`), no data |
| Supervisor | `200`, assigned teams only |

### 2.4 Query design and NFR-10 measurement plan (SR-05)

- **Queries:** one `team.findMany` in scope with milestones (`milestoneInclude` for status) and the grade of released milestones, plus one grouped count of late submission versions per team (`submission.groupBy` or one SQL aggregate). No per-team or per-milestone query.
- **NFR-10 target (SRS):** p95 API response ≤ 500 ms for list and report endpoints with 20 teams, 10 milestones each and 3 versions per milestone.
- **Dataset:** created by the performance test in the separate test database (`cpms_test`), never on the GCP demo database: one supervisor assigned to 20 teams; 10 milestones per team (200); 3 versions per milestone (600 submissions); feedback on the latest version of half the milestones; released grades on a quarter of the milestones.
- **Endpoints measured:** `GET /api/reports/summary` (F-11), `GET /api/board` (F-10), `GET /api/submissions` without filters (F-12, 600 rows) and `GET /api/teams/:teamId/milestones` (Sprint 1 list).
- **Method:** in-process HTTP calls (Supertest against `createApp()`), 5 warm-up calls then 30 measured calls per endpoint, time from request start to full response; p95 by nearest rank (the 29th of 30 sorted values). Each endpoint passes when p95 ≤ 500 ms. The test prints a table (endpoint, p50, p95, max) that is copied into this contract's DoD and the traceability row with the commit and the machine used.
- **Command:** `npm run test:perf --prefix server` (separate Vitest config `server/vitest.perf.config.ts`), not part of `npm test`, because timing on shared CI runners is not stable; it is run on the release-candidate and final commits and the result recorded.
- **Limitation (stated, not hidden):** the measurement runs locally against PostgreSQL in Docker, not against Cloud Run + Cloud SQL, so network latency is excluded; a live single-request check of the report endpoint on the deployed release is recorded as a manual post-deployment check.

### 2.5 Dependencies and layers that need no change

- Depends on F-09 (status helper and include), F-08 (`Grade`, `Milestone.gradesReleasedAt`), F-03 (`Submission.daysLate`).
- **Database:** no schema change, no migration.
- **Existing endpoints and pages:** unchanged.

## 3. UI specification

| Screen | Route | Content | States |
|---|---|---|---|
| Supervisor summary report | `/supervisor/report` (link "Summary report" on `/supervisor`) | At ≥ 768 px: table with columns Team, Milestones, Not submitted, Overdue, Submitted, Submitted late, Reviewed, Late submissions, Average released grade (shown as "—" when `null`, with the number of released grades), and a Totals row; at < 768 px: one card per team with the same values | Loading (`.loading`); error (`.alert`, 401 → logout); no teams (`.empty-state` "You are not assigned to any team yet.") |

- The student UI has no link to the report (the backend still answers `403` if called).
- New classes in `client/src/theme.css` only; no inline styles. NFR-11: no horizontal page scrolling at 375 px and 1280 px.

## 4. API specification

| Method | Path | Auth / role | Request | Success response | Errors |
|---|---|---|---|---|---|
| GET | `/api/reports/summary` | Supervisor (assigned teams) | — | `200 { generatedAt, teams, totals }` | `401 UNAUTHENTICATED`, `403 FORBIDDEN` |

```json
{
  "generatedAt": "2026-12-01T03:00:00.000Z",
  "teams": [
    {
      "teamId": 1,
      "teamName": "Team Alpha",
      "milestoneCount": 4,
      "statusCounts": { "Not submitted": 1, "Overdue": 0, "Submitted": 1, "Submitted late": 1, "Reviewed": 1 },
      "lateSubmissions": 2,
      "releasedGradeCount": 2,
      "averageReleasedGrade": 77.5
    }
  ],
  "totals": {
    "milestoneCount": 4,
    "statusCounts": { "Not submitted": 1, "Overdue": 0, "Submitted": 1, "Submitted late": 1, "Reviewed": 1 },
    "lateSubmissions": 2,
    "releasedGradeCount": 2,
    "averageReleasedGrade": 77.5
  }
}
```

`teams` sorted by team name. Errors use `{ "error": { "code", "message" } }`.

## 5. Data specification

No schema change and no migration. Reads `Team`, `SupervisorAssignment`, `Milestone` (`deadline`, `gradesReleasedAt`), `Submission` (`version`, `daysLate`), `Feedback` count and `Grade.score`.

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-11-01 | **Given** supervisor1 and Team Alpha milestones in known statuses, **when** they request the report, **then** Team Alpha's `statusCounts` equal the number of its milestones in each BR-12 status (the same statuses `GET /api/teams/:id/milestones` returns) and add up to `milestoneCount`. |
| AC-11-02 | **Given** Team Alpha has late versions (`daysLate > 0`) on several milestones, including an earlier late version followed by an on-time resubmission, **when** the report is requested, **then** `lateSubmissions` equals the number of late versions. |
| AC-11-03 | **Given** released grades 70 and 85 and one unreleased grade 10 on Team Alpha, **when** the report is requested, **then** `releasedGradeCount` is 2 and `averageReleasedGrade` is 77.5; **given** a team with no released grade, **then** `averageReleasedGrade` is `null` and the UI shows "—". |
| AC-11-04 | **Given** two assigned teams, **when** the report is requested, **then** `totals` are the sums of the team counts and `totals.averageReleasedGrade` is the mean over all released grades. |
| AC-11-05 | **Given** student1, **when** they call the report, **then** `403 FORBIDDEN` with no report data; **given** no token, **then** `401`; **given** supervisor2, **then** only supervisor2's assigned teams appear (no Team Alpha row). |
| AC-11-06 | **Given** an assigned team without milestones or a supervisor without teams, **when** the report is requested, **then** `200` with that team's counts at zero and average `null`, or `teams: []` with zero totals and the empty-state message in the UI. |
| AC-11-07 | **Given** the report screen, **when** it loads at 1280 px and 375 px, **then** the table (or cards at 375 px) shows every column above including Totals, with no horizontal page scrolling (NFR-11). |
| AC-11-08 | **Given** the NFR-10 dataset (§2.4), **when** each measured endpoint is called 30 times after 5 warm-up calls, **then** its p95 is ≤ 500 ms, and the measured values, commit and machine are recorded. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-11-01 | AC-11-01 | API + DB | Team Alpha: one milestone per BR-12 status (past deadlines inserted directly); Team Beta: two milestones | `GET /api/reports/summary` as supervisor1 | Alpha `statusCounts` = 1 of each status, `milestoneCount` 5; Beta counts match its list endpoint | `server/tests/api/summary-report.api.test.ts` › TEST-11-01 |
| TEST-11-02 | AC-11-02 | API + DB | Alpha: milestone A v1 late + v2 on time (deadline extended between), milestone B v1 late, milestone C v1 on time | Request report | `lateSubmissions` = 2 | same file › TEST-11-02 |
| TEST-11-03 | AC-11-03 | API + DB | Alpha grades: 70 released, 85 released, 10 unreleased; Beta: no released grade | Request report | Alpha `releasedGradeCount` 2, `averageReleasedGrade` 77.5; Beta `averageReleasedGrade` `null` | same file › TEST-11-03 |
| TEST-11-04 | AC-11-04 | API + DB | Data of TEST-11-01..03 | Request report | `totals` = sums of Alpha + Beta; `totals.averageReleasedGrade` = mean of all released grades | same file › TEST-11-04 |
| TEST-11-05 | AC-11-05 | API + DB | Positive control supervisor1 `200`; student1, no token, supervisor2 | Request report | student1 `403 FORBIDDEN` without `teams`; no token `401 UNAUTHENTICATED`; supervisor2 has no row with Alpha's id | same file › TEST-11-05 |
| TEST-11-06 | AC-11-06 | API + DB | Team without milestones assigned to supervisor1 (inserted directly); supervisor without assignments | Request report as each | Empty team: zeros and `null` average; supervisor without teams: `teams: []`, zero totals | same file › TEST-11-06 |
| TEST-11-07 | AC-11-01, AC-11-03, AC-11-06, AC-11-07 | UI | Mocked API: two teams (one with `null` average) and totals; then `teams: []` | Render `/supervisor/report` | All column headers and values; "—" for `null`; Totals row; empty-state message for `teams: []` | `client/tests/SummaryReport.test.tsx` › TEST-11-07 |
| TEST-11-08 | AC-11-07 | E2E | Seeded data; Playwright at 375 × 812 and 1280 × 800 | Log in as supervisor1, open the report | No horizontal page scrolling at both sizes; Team Alpha values visible | `e2e/sprint3-board-report.spec.ts` › TEST-11-08 |
| TEST-11-09 | AC-11-08 | Performance (API) | Dataset of §2.4 in `cpms_test` | `npm run test:perf --prefix server`: 5 warm-up + 30 measured calls to each endpoint in §2.4 | Every endpoint p95 ≤ 500 ms; printed table (p50/p95/max) recorded with commit and machine | `server/tests/perf/nfr10.perf.test.ts` › TEST-11-09 |

## 8. Definition of Done and evidence

- [ ] All AC-11-01..AC-11-08 implemented
- [ ] All STS tests executed and passing on a fresh test database (command, commit and pass/fail/skip counts recorded here)
- [ ] NFR-10 table (endpoint, p50, p95, max, commit, machine) recorded here and in `docs/traceability.md`
- [ ] TDD red → green evidence recorded (contract commit → RED commit with tests only → GREEN commit)
- [ ] Existing Sprint 1–2 tests, F-08 grade tests and F-09 status tests still pass (none weakened or skipped)
- [ ] `docs/system-sds.md`, `docs/traceability.md`, `docs/features.md` and `docs/ai-use.md` updated
- [ ] PR reviewed by the teammate (approve before merge) and merged into `sprint-3`
