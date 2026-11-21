# F-06 Milestone for Several Teams — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-06): contract`), then the failing
> tests (`test(F-06): ...`), then the implementation (`feat(F-06): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-21 | ILoveSiesta | Initial contract for F-06 (issue #63) |
| 0.2 | 2026-11-21 | ILoveSiesta | Definition of Done filled with executed results; no behaviour change |

## 1. Linked requirements

- **FR:** FR-11 (a supervisor creates the same milestone for several of their assigned teams in one action)
- **BR:** BR-04 (title 1–120, description ≤ 2000, deadline later than server time at creation), BR-02 (supervisor scope: assigned teams), BR-03 (supervisor-only operation → 403 for students)
- **NFR:** NFR-02 (401 on the new endpoint), NFR-03 (403/404 without data), NFR-05 (safe error shape), NFR-12 (UI shows the reason for a rejection)
- **Decisions:** D-04 (several supervisors per team: any assigned supervisor may act), D-06 (teams and assignments come from the seed)

## 2. Feature-level design

- **Behaviour and workflow**
  - On **Supervisor team detail** (`/supervisor/teams/:teamId`) the **New milestone** form gets a **Teams** group listing the supervisor's assigned teams as checkboxes. The current team is always included (checked and disabled, labelled "(this team)"); the other assigned teams are unchecked.
  - If no other team is selected, the form keeps using the F-02 endpoint `POST /api/teams/:teamId/milestones` exactly as before.
  - If one or more other teams are selected, the form calls the new endpoint `POST /api/milestones` with the current team and the selected teams. The server creates **one `Milestone` row per team**, with the same title, description and deadline, so submissions, feedback, grades and status stay per team. The current team's new milestone is added to its list, and a status line names every team it was created for.
- **Business rules and validation**
  - `teamIds`: required array of 1–20 distinct positive integers.
    - Missing, `null` or empty array → `REQUIRED`; not an array, or an element that is not a positive integer (e.g. `0`, `-1`, `1.5`, `"1"`) → `INVALID_TYPE`; the same ID twice → `DUPLICATE`; more than 20 IDs → `TOO_MANY`.
    - The limit of 20 bounds one request; it is above the number of teams a supervisor has in the chosen context (A-01, NFR-10 sizes the data set at 20 teams).
  - `title`, `description`, `deadline`: the same rules as F-02 (BR-04), using the existing `validateMilestoneInput` with the server time at the request.
  - **All-or-nothing:** if any listed team does not exist or is not assigned to the supervisor, nothing is created and the response is `404 NOT_FOUND` with no data; it does not say which team failed (NFR-03, same as F-02). All rows are created in **one database transaction**; if one insert fails, none is stored.
- **Access and check order** (SDS §4–§5): authenticate (401) → role (403) → `teamIds` format (400) → record scope of every team (404) → milestone fields (400) → create.
  - The `teamIds` format is checked before scope because the list must be readable before its teams can be looked up. This is the only 400 that comes before the scope check, and it reveals nothing about other teams.
  - Student → `403 FORBIDDEN` before the body is read; nothing is stored. No token → `401 UNAUTHENTICATED`.
- **Failure and boundary cases:** 1 team → accepted (same result as F-02 for that team); 20 teams → passes validation; 21 → `400 TOO_MANY`; duplicate → `400 DUPLICATE`; one unassigned or unknown team among assigned ones → `404`, nothing stored; deadline equal to server time → `400 MUST_BE_FUTURE` (BR-04).
- **Dependencies:** F-02 (`validateMilestoneInput`, `toMilestoneDto`, scope rules, team detail page), F-01 (`authenticate`, `requireRole`), F-05 (same service and route files; no behaviour shared).
- **F-02 is unchanged:** `POST /api/teams/:teamId/milestones` keeps its behaviour, request and response; its tests stay as they are.

## 3. UI specification

| Screen | Route | Change | States |
|---|---|---|---|
| Supervisor team detail | `/supervisor/teams/:teamId` | **New milestone** form: new `<fieldset>` with legend **Teams**; one checkbox per assigned team (from `GET /api/teams`), sorted by name; the current team is checked and disabled with the label `<name> (this team)` | Saving: button disabled, "Saving…"; success with other teams: status line `Milestone created for N teams: <names>` (`role="status"`), the current team's list shows the new milestone, form fields and extra checkboxes cleared; 404 from the new endpoint: the API message in the form alert; `400` with `teamIds`: message under the Teams group; field errors under inputs (F-02 texts); 401 → logout |
| Other screens | — | No change: each team's pages read their own milestone through F-02 | — |

- `teamIds` error texts: `REQUIRED` → "Select at least one team"; `INVALID_TYPE` → "Invalid team selection"; `DUPLICATE` → "A team is selected twice"; `TOO_MANY` → "Select at most 20 teams".
- If the team list cannot be loaded, the form still works for the current team (F-02 path).
- Styling uses the shared classes in `client/src/theme.css` (`card`, `form-field`, `has-error`, `field-error`, `btn`, `alert`, `muted`); a new `.team-options` class lays out the checkboxes; no inline styles.

## 4. API specification

All responses use the JSON error shape from SDS §4. IDs are integers; timestamps are ISO 8601 UTC strings.

| Method | Path | Auth / role | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/milestones` | Supervisor, assigned to every listed team | `{ teamIds: number[], title: string, description?: string \| null, deadline: string }` | `201 { milestones: Milestone[] }` — one per team, in the order of `teamIds`; same `Milestone` shape as F-02 | 401, 403, 400, 404 |

No change to existing endpoints.

Validation error examples (400):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid team selection", "details": { "teamIds": "DUPLICATE" } } }
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid milestone", "details": { "title": "REQUIRED", "deadline": "MUST_BE_FUTURE" } } }
```

Scope rejection (404, nothing stored):

```json
{ "error": { "code": "NOT_FOUND", "message": "Resource not found" } }
```

## 5. Data specification

No schema change and no migration: each team gets an ordinary `Milestone` row (F-02 model: `teamId`, `title`, `description`, `deadline`, `createdById`, `createdAt`). The rows are not linked to each other; editing one later (F-05) does not change the others.

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-06-01 | Given supervisor1 (assigned to Alpha and Beta), when `POST /api/milestones` with `teamIds` [Alpha, Beta] and valid fields, then `201` with two milestones in that order, each with its own `id` and `teamId` and the same title, description and deadline, created by supervisor1; two rows are stored. |
| AC-06-02 | Given the two milestones of AC-06-01, when student1 (Alpha) and student3 (Beta) list their team's milestones, then each sees only their own team's milestone; student1 reading Beta's milestone gets `404`. |
| AC-06-03 | Given `teamIds` that include a team not assigned to the supervisor (Gamma) or an unknown ID, when `POST /api/milestones`, then `404 NOT_FOUND` and no milestone with that title exists for any team; the same request without that team succeeds. |
| AC-06-04 | Given a valid request, when student1 sends it, then `403 FORBIDDEN`; without a token, `401 UNAUTHENTICATED`; nothing is stored in either case. |
| AC-06-05 | Given an assigned supervisor, when `teamIds` is missing, empty, not an array, contains `0`, `-1`, `1.5` or `"1"`, contains a duplicate, or has 21 IDs, then `400 VALIDATION_ERROR` with `details.teamIds` = `REQUIRED` / `INVALID_TYPE` / `DUPLICATE` / `TOO_MANY`; when the teams are valid but the title is blank or the deadline is in the past, then `400` with the field details; nothing is stored. |
| AC-06-06 | Given the F-02 endpoint `POST /api/teams/:teamId/milestones`, when it is used as in Sprint 1, then its behaviour, responses and tests are unchanged. |
| AC-06-07 | Given supervisor1 on `/supervisor/teams/1`, when they fill the form, tick Team Beta and click **Create milestone**, then the request goes to `POST /api/milestones` with `teamIds: [1, 2]` and the fields, the new milestone appears in Alpha's list and the status line reads "Milestone created for 2 teams: Team Alpha, Team Beta". With no other team ticked, the F-02 request is sent unchanged. |
| AC-06-08 | Given the form with another team ticked, when the API answers `404`, then the API message is shown in the form alert; when it answers `400` with `details.teamIds`, then the matching text is shown under **Teams**; nothing is added to the list. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-06-01 | AC-06-01 | API + DB | Seeded; supervisor1 token | `POST /api/milestones` `{ teamIds: [Alpha, Beta], title, description, deadline: +7 d }` | 201; `milestones` length 2 in request order; teamIds match; same fields; `createdBy.id` = supervisor1; 2 DB rows with the title | `server/tests/api/multi-team-milestone.api.test.ts` › TEST-06-01 |
| TEST-06-02 | AC-06-02 | API + DB | Milestones from a TEST-06-01-style request | `GET /api/teams/:id/milestones` as student1 (Alpha) and student3 (Beta); `GET /api/milestones/:betaId` as student1 | each list contains only its own team's new milestone; 404 for student1 on Beta's | same file › TEST-06-02 |
| TEST-06-03 | AC-06-03 | API + DB | supervisor1 token | `teamIds` [Alpha, Gamma]; then [Alpha, 999999]; then [Alpha] (positive control) | 404 / 404 with no row with the title for any team; control 201 with 1 row | same file › TEST-06-03 |
| TEST-06-04 | AC-06-04 | API + DB | student1 token; no token; supervisor1 (positive control) | Same valid body | 403 / 401, no row; supervisor1 201 | same file › TEST-06-04 |
| TEST-06-05 | AC-06-05 | API + DB | supervisor1 token | Each invalid `teamIds`; then valid teams with blank title + past deadline | 400 with the expected `details`; no row with the titles used | same file › TEST-06-05 |
| TEST-06-06 | AC-06-05 | Unit | — | `validateTeamIds` boundaries | `[1]` ok; 20 IDs ok; 21 `TOO_MANY`; `[]` / missing `REQUIRED`; `[1, 1]` `DUPLICATE`; `[0]`, `[-1]`, `[1.5]`, `["1"]`, `"1"` `INVALID_TYPE` | `server/tests/unit/team-ids-validation.test.ts` › TEST-06-06 |
| TEST-06-07 | AC-06-06 | API + UI (existing) | — | Existing F-02 tests | TEST-02-05..TEST-02-08, TEST-02-11, TEST-02-14, TEST-02-15 still pass unchanged | `server/tests/api/teams-milestones.api.test.ts`; `server/tests/unit/milestone-validation.test.ts`; `client/tests/Milestones.test.tsx` |
| TEST-06-08 | AC-06-07 | UI | Mocked API: supervisor; teams Alpha (1) and Beta (2); Alpha has no milestones | Fill the form, tick Team Beta, create | POST `/api/milestones` body `{ teamIds: [1, 2], title, description, deadline }`; Alpha's list shows the title; status line text; "Team Alpha (this team)" checkbox checked and disabled | `client/tests/MultiTeamMilestone.test.tsx` › TEST-06-08 |
| TEST-06-09 | AC-06-08 | UI | Mocked API: new endpoint answers 404, then 400 `{ teamIds: "TOO_MANY" }` | Tick Team Beta, create (twice) | Alert "Resource not found"; then "Select at most 20 teams" under Teams; no milestone added | same file › TEST-06-09 |

## 8. Definition of Done and evidence

- [x] All AC-06-01..AC-06-08 implemented
- [x] All STS tests executed and passing on a fresh test database — on `997b7d1`: `npm run build` OK; `npm test` server 107 passed (F-06: 5 API + 1 unit), client 23 passed (F-06: 2), 0 failed, 0 skipped; `npm run test:e2e` 4 passed; `python -m unittest discover -s deploy/tests` 17 OK. CI `test-and-docker`: recorded on the PR
- [x] TDD red → green: failing tests `29ac32c` (tests only) on the pre-change code `feaafdb`: build OK; server 6 failed — 5 API with `404` because `POST /api/milestones` did not exist (each negative case has a positive control, so none passed vacuously), 1 unit with `validateTeamIds is not a function`; client 2 failed — no **Teams** group → implementation `997b7d1` (all pass). TEST-06-07 (existing F-02 tests) passed at RED and GREEN, as intended
- [x] SRS: no change needed (FR-11 and BR-04 already state the rule; the details are in this contract). System SDS §3.1 / §4.2 / §5 (v0.8), `docs/traceability.md` (v1.8), `docs/features.md` (v1.3) updated
- [ ] PR reviewed by phet526 (approve before merge) and merged into `sprint-2`
