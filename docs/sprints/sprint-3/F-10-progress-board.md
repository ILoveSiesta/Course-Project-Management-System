# F-10 Progress Board — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-10): contract`), then the failing
> tests (`test(F-10): ...`), then the implementation (`feat(F-10): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.
>
> **Status (v0.1):** contract only, written in #84 before the Deliverable 2 checkpoint (D2 §3.3). Implementation
> follows after Deliverable 2 in its own Issue (contract → RED → GREEN); until then every test below is PLANNED.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-22 | ILoveSiesta | Initial contract for F-10 (#84) |

## 1. Linked requirements

- **FR:** FR-21 (progress board: a student sees their team's milestones by status; a supervisor sees a teams × milestones view of assigned teams)
- **BR:** BR-12 (derived status, evaluated at request time, never stored), BR-01 (student own-team scope), BR-02 (supervisor assigned-team scope), BR-05 rev. / CHG-03 (Overdue covers the 7-day late window and after it, as in F-09)
- **NFR:** NFR-02 (401), NFR-03 (scope enforced by the backend), NFR-10 (board endpoint inside the Sprint 3 response-time check, see F-11 §2.4), NFR-11 (375 px and 1280 px without horizontal page scrolling)
- **Decisions:** D-04 (a team may have several supervisors), D-05 (a student belongs to at most one team), D-06 (teams created by F-13 appear on the board like seeded teams)

## 2. Feature-level design

### 2.1 Behaviour and workflow

- One read-only endpoint `GET /api/board` returns, for the caller's scope, every team with its milestones and their derived `status`. Nothing is written.
- **Student:** the board contains only their own team (at most one, D-05). The UI groups the milestones into five status groups in BR-12 order: **Not submitted**, **Overdue**, **Submitted**, **Submitted late**, **Reviewed**. Each milestone links to the existing milestone page.
- **Supervisor:** the board contains every assigned team (sorted by team name). The UI shows a matrix: one row per team, one column per milestone title. A cell shows the status badge of that team's milestone and links to it; a team without a milestone of that title shows "—".
- **Column rule:** columns are keyed by the exact stored milestone title (F-06 creates the same title for several teams). Columns are ordered by the earliest deadline of any milestone with that title, then by title. If one team has two milestones with the same title, the cell lists both badges in deadline order. This is a display grouping only; milestones stay per team.
- **Status source:** the same pure helper as F-09 (`deriveMilestoneStatus`) with one `now` captured per request, so a board cell and `GET /api/milestones/:id` at the same time never disagree.

### 2.2 Business rules, validation, failure and boundary cases

- No input other than the token; query parameters are ignored (filtering is F-12).
- A student without a team gets `200` with `teams: []` (UI: "You are not in a team yet.").
- A supervisor without assigned teams gets `200` with `teams: []` (UI: "You are not assigned to any team yet.").
- A team without milestones (for example a team just created with F-13) is still returned with `milestones: []`; in the supervisor matrix its row shows "No milestones yet".
- Boundaries inherited from F-09: `now === deadline` → Not submitted; `now > deadline` with no submission → Overdue (inside and after the 7-day window); a resubmission after feedback returns to Submitted / Submitted late.

### 2.3 Permissions

| Caller | Result |
|---|---|
| No / invalid / logged-out token | `401 UNAUTHENTICATED` |
| Student | `200`, own team only |
| Supervisor | `200`, assigned teams only; unassigned teams never appear |

There is no `teamId` parameter, so there is nothing to probe; scope comes from `scopeFilter(user)` (`server/src/services/teams.service.ts`).

### 2.4 Query design (no N+1)

One `team.findMany({ where: scopeFilter(user), include: { milestones: { include: milestoneInclude } } })` — the same `milestoneInclude` as F-09 (latest submission version + feedback count). No per-team or per-milestone queries.

### 2.5 Dependencies and layers that need no change

- Depends on F-09 (`deriveMilestoneStatus`, `milestoneInclude`, `toMilestoneDto`) and F-02 (teams, milestones).
- **Database:** no schema change, no migration.
- **Existing endpoints and pages:** unchanged; the board is a new endpoint and two new screens.

## 3. UI specification

| Screen | Route | Content | States |
|---|---|---|---|
| Student progress board | `/student/board` (link "Progress board" on `/student`) | Team name; five sections in BR-12 order, each with a heading, a count and milestone cards (title, deadline via `formatDeadline`, status badge, link to `/student/milestones/:id`) | Loading (`.loading`); error (`.alert`, 401 → logout); no team (`.empty-state` "You are not in a team yet."); empty section shows "None" |
| Supervisor progress board | `/supervisor/board` (link "Progress board" on `/supervisor`) | At ≥ 768 px: table, rows = teams, columns = milestone titles, cell = status badge(s) linking to `/supervisor/milestones/:id` or "—"; at < 768 px: one card per team listing "title — status badge" | Loading; error; no teams (`.empty-state` "You are not assigned to any team yet."); team row without milestones "No milestones yet" |

- Badges reuse the F-09 mapping in `client/src/theme.css`: Reviewed `.badge-success`, Submitted `.badge`, Submitted late `.badge-warning`, Overdue `.badge-danger`, Not submitted `.badge-neutral`. New layout classes (for example `.board-grid`, `.board-table`) go into `theme.css`; no inline styles.
- NFR-11: no horizontal page scrolling at 375 px and 1280 px (the narrow layout replaces the table).

## 4. API specification

| Method | Path | Auth / role | Request | Success response | Errors |
|---|---|---|---|---|---|
| GET | `/api/board` | Any authenticated user (scope by role) | — | `200 { generatedAt, columns, teams }` | `401 UNAUTHENTICATED` |

```json
{
  "generatedAt": "2026-12-01T03:00:00.000Z",
  "columns": [
    { "key": "SRS draft", "title": "SRS draft", "firstDeadline": "2026-12-02T16:59:00.000Z" }
  ],
  "teams": [
    {
      "id": 1,
      "name": "Team Alpha",
      "milestones": [
        { "id": 10, "title": "SRS draft", "deadline": "2026-12-02T16:59:00.000Z", "status": "Submitted late", "columnKey": "SRS draft" }
      ]
    }
  ]
}
```

`teams` sorted by name; `milestones` sorted by deadline then id; `columns` as in §2.1. Errors use `{ "error": { "code", "message" } }`.

## 5. Data specification

No schema change and no migration. Reads `Team`, `TeamMembership`, `SupervisorAssignment`, `Milestone`, latest `Submission` and its `Feedback` count.

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-10-01 | **Given** student1 (Team Alpha) with milestones in several statuses, **when** they open the board, **then** `GET /api/board` returns only Team Alpha with every Team Alpha milestone and its derived status, and the UI shows the milestones under the five status groups in BR-12 order with a count per group. |
| AC-10-02 | **Given** supervisor1 (assigned Alpha and Beta) and milestones created for both teams with the same title, **when** they open the board, **then** the response contains both teams and one column for that title, and the UI matrix shows one row per team with the status badge in that column and "—" where a team has no milestone of a column's title. |
| AC-10-03 | **Given** any milestone on the board, **when** the board and `GET /api/milestones/:id` are read at the same time, **then** the status is identical (one `now` per request, same helper as F-09), including Overdue after the 7-day window closes. |
| AC-10-04 | **Given** student3 (Team Beta) and supervisor2 (not assigned to Alpha), **when** they request the board, **then** no Team Alpha team or milestone appears in the response; **given** no token, **then** `401 UNAUTHENTICATED`. |
| AC-10-05 | **Given** a supervisor team without milestones, a student without a team, or a supervisor without teams, **when** the board loads, **then** the response is `200` with the team listed with `milestones: []` or with `teams: []`, and the UI shows "No milestones yet" / the empty-state message. |
| AC-10-06 | **Given** a board cell or card, **when** the user selects it, **then** they reach the existing milestone page (`/student/milestones/:id` or `/supervisor/milestones/:id`). |
| AC-10-07 | **Given** viewport widths of 375 px and 1280 px, **when** each board is shown, **then** there is no horizontal page scrolling and every status remains readable (NFR-11). |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-10-01 | AC-10-01 | API + DB | Team Alpha: one milestone per status (future/no submission, past/no submission, on-time v1, late v1, v1 with feedback); Team Beta milestone | `GET /api/board` as student1 | Only Team Alpha; 5 milestones with statuses Not submitted, Overdue, Submitted, Submitted late, Reviewed | `server/tests/api/board.api.test.ts` › TEST-10-01 |
| TEST-10-02 | AC-10-02 | API + DB | supervisor1; F-06 milestone "Board check" for Alpha and Beta; extra Alpha-only milestone | `GET /api/board` as supervisor1 | Both teams sorted by name; one column "Board check"; Alpha row has both milestones, Beta only "Board check"; `columns` ordered by first deadline | same file › TEST-10-02 |
| TEST-10-03 | AC-10-03 | API + DB | Alpha milestone 10 d past deadline (inserted directly), no submission | `GET /api/board` and `GET /api/milestones/:id` as supervisor1 | Both `Overdue`; every board status equals the detail status | same file › TEST-10-03 |
| TEST-10-04 | AC-10-04 | API + DB | Positive controls student1 / supervisor1 see Alpha; student3, supervisor2, no token | `GET /api/board` | student3 and supervisor2: no team with id Alpha and no Alpha milestone ids; no token: `401 UNAUTHENTICATED` | same file › TEST-10-04 |
| TEST-10-05 | AC-10-05 | API + DB | New team with supervisor1 assigned and no milestones (inserted directly); a student user without membership; a supervisor without assignments | `GET /api/board` as each | `200`; empty team listed with `milestones: []`; `teams: []` for the other two | same file › TEST-10-05 |
| TEST-10-06 | AC-10-01, AC-10-05, AC-10-06 | UI | Mocked API: student board with all five statuses; then `teams: []` | Render `/student/board` | Five group headings in BR-12 order with counts; each card links to `/student/milestones/:id`; empty data shows "You are not in a team yet." | `client/tests/ProgressBoard.test.tsx` › TEST-10-06 |
| TEST-10-07 | AC-10-02, AC-10-05, AC-10-06 | UI | Mocked API: supervisor board with two teams, shared and team-only titles, one team without milestones | Render `/supervisor/board` | Matrix rows per team; "—" in empty cells; "No milestones yet" row; badges link to `/supervisor/milestones/:id` | same file › TEST-10-07 |
| TEST-10-08 | AC-10-07 | E2E | Seeded data; Playwright at 375 × 812 and 1280 × 800 | Log in as student1 and supervisor1, open each board | `document.documentElement.scrollWidth <= window.innerWidth` on both boards at both sizes; status badges visible | `e2e/sprint3-board-report.spec.ts` › TEST-10-08 |

## 8. Definition of Done and evidence

- [ ] All AC-10-01..AC-10-07 implemented
- [ ] All STS tests executed and passing on a fresh test database (command, commit and pass/fail/skip counts recorded here)
- [ ] TDD red → green evidence recorded (contract commit → RED commit with tests only → GREEN commit)
- [ ] Existing Sprint 1–2 tests, F-09 status tests and the BR-05 rev. window tests still pass (none weakened or skipped)
- [ ] `docs/system-sds.md`, `docs/traceability.md`, `docs/features.md` and `docs/ai-use.md` updated
- [ ] PR reviewed by the teammate (approve before merge) and merged into `sprint-3`
