# F-08 Grades and Grade Release — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-08): contract`), then the failing
> tests (`test(F-08): ...`), then the implementation (`feat(F-08): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-21 | ILoveSiesta | Initial contract for F-08 (issue #66); decisions G1–G7 agreed by both students in #66 |
| 0.2 | 2026-11-21 | ILoveSiesta | AC-08-06 / TEST-08-06 corrected before the test commit: student3 is a student, so `PUT` and release are rejected by role (403) before the scope check; only its `GET` gives 404. Validation helper named `validateGradeInput` in `server/src/utils/validation.ts` |
| 0.3 | 2026-11-21 | ILoveSiesta | Definition of Done filled with executed results; no behaviour change |
| 0.4 | 2026-11-22 | phet526 | Defect #93 (`DEF-GRADE-RELEASE`): revise §2, §3, §6 (`AC-08-10`) and §7 (`TEST-08-12`) so **Release grade** is disabled with `"Save the grade before releasing"` whenever **Score** or **Graded version** has unsaved edits vs the stored grade |
| 0.5 | 2026-11-22 | phet526 | Update §8.1 DoD with `DEF-GRADE-RELEASE` (#93) RED (`6cd2e11`, CI `45034210203`) → GREEN (`f5a0912`, CI `45034474980`, `201 / 201` passed) evidence |
| 0.6 | 2026-11-22 | phet526 | Address PR #97 review (`8114740`): revise §2, §3, §6 (`AC-08-10`), and §7 (`TEST-08-12..14`) — place `"Save the grade before releasing"` after `.form-actions`, compare numeric score value while treating empty `score` as changed, disable **Score** and **Graded version** while `isBusy`, clarify `"saves successfully"` in `AC-08-10`, and add `TEST-08-13`–`TEST-08-14` plus empty-score and changed-score Save→Release coverage in `TEST-08-12` |
| 0.7 | 2026-11-22 | phet526 | Update §8.1 DoD with PR #97 traceability refs (`2.14`, `2.15`), labeled CI `45034210203` client counts, and round-2 `DEF-GRADE-RELEASE` (#93) RED (`25b0e18`) → GREEN (`36d0d99`, CI `45044529526`, `226 / 226` passed) evidence |

## 1. Linked requirements

- **FR:** FR-18 (a supervisor records a grade for a team's milestone, linked to the graded submission version), FR-19 (a supervisor releases the milestone's grades; students see a grade only after release)
- **BR:** BR-11 (grade visibility after release; scale and change rules detailed by this contract, SRS v0.8), BR-01 (student scope), BR-02 (supervisor scope), BR-03 (supervisor-only operations → 403)
- **NFR:** NFR-02 (401 on the new endpoints), NFR-03 (403/404 without data; a student never receives an unreleased score), NFR-05 (safe error shape), NFR-12 (UI shows the reason for a rejection)
- **Decisions:** D-03 (feedback visible at once, grades hidden until release), D-04 (any assigned supervisor may act)

## 2. Feature-level design

- **Behaviour and workflow**
  - On **Supervisor milestone detail** (`/supervisor/milestones/:milestoneId`) a new **Grade** card shows the current grade, e.g. `85 / 100 (graded on Version 1)`, and whether it is released. Before release it has a form with **Score** (0–100) and **Graded version** (a select of this milestone's versions, latest selected by default) and a **Save grade** button, plus a **Release grade** button once a grade exists. If the form's **Score** or **Graded version** differs from the stored grade, **Release grade** stays disabled and the card displays `"Save the grade before releasing"` after `.form-actions` until the supervisor either saves successfully or reverts the fields to the stored values. After release the form and buttons are gone and the card shows `Released: <time> (ICT)`.
  - On **Student milestone detail** (`/student/milestones/:milestoneId`) a **Grade** card shows "Grade not released" until release, then `85 / 100 (graded on Version 1)`.
- **Business rules** (G1–G7 from #66)
  - **G1 scale:** the score is an integer from 0 to 100.
  - **G2 link:** at most **one grade per milestone** (each milestone belongs to one team). The request names the **version number of this milestone**; the server looks it up only among this milestone's submissions, so a submission of another team can never be referenced.
  - **G3 change:** the grade may be saved again (score and/or version) any number of times before release; the stored grade keeps who saved it last and when (`gradedBy`, `gradedAt`). After release it is locked.
  - **G4 release:** per milestone, requires a grade, irreversible. The release time is stored on the milestone (`gradesReleasedAt`); a second release is rejected and the first time is kept.
  - **G5 visibility:** assigned supervisors always see the grade and its release state. For a student, the **backend** returns `grade: null`, `released: false`, `releasedAt: null` before release, whether or not a grade exists, so no score, version or time leaves the server.
  - **G6 who:** any supervisor assigned to the team (D-04); students → 403.
  - **G7 nothing submitted:** a milestone without any submission cannot be graded.
- **Validation and error order** (SDS §4: 401 → 403 → 404 → 400 → 409, with the order of the data-dependent checks fixed here)
  - Save grade: authenticate (401) → role (403) → milestone in scope (404) → body format (400: `score` integer 0–100, `version` positive integer) → milestone has no submission (409 `NOTHING_TO_GRADE`) → `version` not among this milestone's versions (400 `details.version = NOT_FOUND`) → grades already released (409 `GRADE_RELEASED`) → save.
    - `NOTHING_TO_GRADE` is checked before the version lookup because, with no submission, every version is missing and the clearer reason is that nothing can be graded.
  - Release: 401 → 403 → 404 → already released (409 `GRADE_RELEASED`) → no grade (409 `NO_GRADE`) → release.
  - Read: 401 → 404 (out of scope) → 200.
- **Integrity:** save and release run in one transaction that locks the milestone row (`SELECT … FOR UPDATE`), so a save can never land after a release that it raced with, and two releases cannot both succeed.
- **Failure and boundary cases:** score `0` and `100` accepted; `-1`, `101`, `85.5`, `"85"` → 400; version of another milestone (even of the same team) → 400 `NOT_FOUND`; save after release → 409 and the stored grade is unchanged; release twice → 409 and `gradesReleasedAt` unchanged.
- **Dependencies:** F-03 (submissions and versions of the milestone), F-02 (milestone scope), F-01 (`authenticate`, `requireRole`). F-11 (Sprint 3) will use released grades for the summary report.

## 3. UI specification

| Screen | Route | Change | States |
|---|---|---|---|
| Supervisor milestone detail | `/supervisor/milestones/:milestoneId` | New **Grade** card under the milestone card | No submission: "Nothing to grade yet" and no form; not graded: "Not graded yet", form; graded, not released: `85 / 100 (graded on Version 1)`, "Not released", form filled with the stored values, **Release grade** button enabled when unchanged; unsaved form edits (evaluated by numeric score while keeping empty score as changed: `score.trim() === "" || Number(score) !== state.grade.score || version !== String(state.grade.version)`): **Release grade** disabled and status text `"Save the grade before releasing"` (`role="status"`, `.muted`) rendered after `.form-actions` so showing or hiding it cannot shift the buttons, **Save grade** stays enabled (reverting or saving successfully re-enables **Release grade**); released: grade line + `Released: <time> (ICT)`, no form; saving/releasing (`isBusy`): both **Score** and **Graded version** fields (`disabled={isBusy}`) as well as action buttons disabled; 409/400: the API message in an alert in the card, or the field text under the field; 401 → logout |
| Student milestone detail | `/student/milestones/:milestoneId` | New **Grade** card | Not released: "Grade not released"; released: `85 / 100 (graded on Version 1)` |

- Field texts: score `REQUIRED` → "Required", `INVALID_TYPE` / `OUT_OF_RANGE` → "Enter a whole number from 0 to 100"; version `REQUIRED` / `INVALID_TYPE` / `NOT_FOUND` → "Choose a version of this milestone".
- If the grade cannot be loaded, the rest of the page still works (the card shows nothing).
- Styling uses the shared classes in `client/src/theme.css` (`card`, `form-field`, `has-error`, `field-error`, `btn`, `btn-secondary`, `alert`, `muted`, `badge`); no inline styles.

## 4. API specification

All responses use the JSON error shape from SDS §4. IDs are integers; timestamps are ISO 8601 UTC strings.

| Method | Path | Auth / role | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/api/milestones/:milestoneId/grade` | Any, in scope | — | `200 GradeState` (student before release: `{ grade: null, released: false, releasedAt: null }`) | 401, 404 |
| PUT | `/api/milestones/:milestoneId/grade` | Supervisor, assigned | `{ score: number, version: number }` | `200 GradeState` | 401, 403, 404, 400, 409 |
| POST | `/api/milestones/:milestoneId/grade/release` | Supervisor, assigned | — | `200 GradeState` with `released: true` | 401, 403, 404, 409 |

```ts
type GradeState = {
  grade: {
    score: number;            // 0–100
    version: number;          // version number of the graded submission in this milestone
    submissionId: number;
    gradedBy: { id: number; name: string };
    gradedAt: string;         // last save
  } | null;
  released: boolean;
  releasedAt: string | null;
};
```

Errors:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid grade", "details": { "score": "OUT_OF_RANGE" } } }
{ "error": { "code": "NOTHING_TO_GRADE", "message": "There is no submission to grade" } }
{ "error": { "code": "GRADE_RELEASED", "message": "Grades for this milestone have been released and can no longer be changed" } }
{ "error": { "code": "NO_GRADE", "message": "Record a grade before releasing" } }
```

`details` values: `score` → `REQUIRED`, `INVALID_TYPE`, `OUT_OF_RANGE`; `version` → `REQUIRED`, `INVALID_TYPE`, `NOT_FOUND`.

No change to existing endpoints.

## 5. Data specification

Migration `f08_grades`:

- New model **Grade**

| Field | Type | Constraint |
|---|---|---|
| `id` | Int | PK, auto-increment |
| `milestoneId` | Int | FK → `Milestone.id`, `ON DELETE RESTRICT`, **unique** (one grade per milestone) |
| `submissionId` | Int | FK → `Submission.id`, `ON DELETE RESTRICT` (the graded version; the service only accepts a submission of the same milestone) |
| `score` | Int | not null; DB check `score BETWEEN 0 AND 100` (added by hand in the migration SQL as a backstop) |
| `gradedById` | Int | FK → `User.id`, `ON DELETE RESTRICT` (supervisor who saved last) |
| `createdAt` | TIMESTAMPTZ(3) | default now() |
| `updatedAt` | TIMESTAMPTZ(3) | updated on every save; returned as `gradedAt` |

- **Milestone**: new nullable column `gradesReleasedAt` TIMESTAMPTZ(3) (null = not released).
- Existing rows: no grade, not released. No data backfill.

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-08-01 | Given a milestone on Alpha with versions 1 and 2, when supervisor1 sends `PUT …/grade` `{ score: 85, version: 1 }`, then `200` with `grade.score 85`, `grade.version 1`, `gradedBy` supervisor1, `released: false`, and one `Grade` row is stored linked to version 1's submission. |
| AC-08-02 | Given a stored, unreleased grade, when the supervisor saves `{ score: 90, version: 2 }`, then `200`, the same row now has score 90 and version 2's submission, and `gradedAt` is not earlier than before; still one row. Scores 0 and 100 are accepted. |
| AC-08-03 | Given a graded milestone, when the supervisor sends `POST …/grade/release`, then `200` with `released: true` and `releasedAt` set; `gradesReleasedAt` is stored. A second release → `409 GRADE_RELEASED` and `releasedAt` is unchanged; a save after release → `409 GRADE_RELEASED` and the grade is unchanged. |
| AC-08-04 | Given a milestone with no grade (but with submissions), when the supervisor releases, then `409 NO_GRADE` and nothing is stored; given a milestone with no submission, when the supervisor saves a grade, then `409 NOTHING_TO_GRADE` and nothing is stored. |
| AC-08-05 | Given a stored but unreleased grade, when a student of the team reads `GET …/grade`, then `200 { grade: null, released: false, releasedAt: null }` and the response body contains no score, version or grader; after release the student receives the full grade. The supervisor always receives the grade. |
| AC-08-06 | Given a milestone on Alpha, when student1 sends `PUT …/grade` or `POST …/grade/release`, then `403`; when supervisor2 (not assigned to Alpha) sends any of the three requests, or student3 (Beta) reads the grade, then `404` (student3's `PUT` and release get `403` by role first); without a token, `401`. Nothing changes in any case, while supervisor1 can do the same. Supervisor2 can grade a Beta milestone (two supervisors, D-04). |
| AC-08-07 | Given an assigned supervisor, when the body has a missing, negative, 101, decimal or string score, or a missing, zero or non-integer version, then `400 VALIDATION_ERROR` with `details`; when the version number does not exist in this milestone (including one that exists only in another milestone), then `400` with `details.version = NOT_FOUND`; nothing is stored. |
| AC-08-08 | Given a supervisor on Supervisor milestone detail with two versions, when they enter a score, keep the default (latest) version and click **Save grade**, then the request is `PUT …/grade { score, version: 2 }` and the card shows `<score> / 100 (graded on Version 2)` and "Not released"; when they click **Release grade**, then the card shows `Released: … (ICT)` and the form is gone; a 409 or 400 from the API is shown in the card. |
| AC-08-09 | Given a student on Student milestone detail, when the API returns an unreleased state, then the Grade card shows "Grade not released"; when it returns a released grade, then it shows `<score> / 100 (graded on Version N)`. |
| AC-08-10 | Given a milestone with a stored unreleased grade, when the supervisor edits **Score** (compared by numeric value, with empty treated as changed) or **Graded version** without saving, then **Release grade** is disabled and the card displays `"Save the grade before releasing"` after `.form-actions` (no release request is sent); while a save or release request is in flight (`isBusy`), both **Score** and **Graded version** fields and buttons remain disabled; when the supervisor reverts the inputs to the stored values or saves **successfully**, **Release grade** is enabled again and releases the stored grade. |

## 7. Software Test Specification (STS)

| Test ID | AC | Level | Precondition / input | Action | Expected result | File › test |
|---|---|---|---|---|---|---|
| TEST-08-01 | AC-08-01 | API + DB | Seeded; milestone on Alpha with v1, v2 (student1 submits twice); supervisor1 token | `PUT …/grade { score: 85, version: 1 }` | 200 body as AC; one `Grade` row, `submissionId` = v1, `gradedById` = supervisor1 | `server/tests/api/grades.api.test.ts` › TEST-08-01 |
| TEST-08-02 | AC-08-02 | API + DB | Grade from TEST-08-01 | `PUT { score: 90, version: 2 }`; then `{ score: 0 }`, `{ score: 100 }` (version 2) | 200 each; still one row; last score 100, version 2; `gradedAt` not earlier | same file › TEST-08-02 |
| TEST-08-03 | AC-08-03 | API + DB | Graded milestone | release; release again; `PUT` after release | 200 `released: true`; 409 `GRADE_RELEASED` with `releasedAt` unchanged in DB; 409 and grade unchanged | same file › TEST-08-03 |
| TEST-08-04 | AC-08-04 | API + DB | Milestone with a submission but no grade; milestone with no submission | release on the first; `PUT { score: 70, version: 1 }` on the second | 409 `NO_GRADE`, `gradesReleasedAt` null; 409 `NOTHING_TO_GRADE`, no `Grade` row | same file › TEST-08-04 |
| TEST-08-05 | AC-08-05 | API + DB | Graded, unreleased milestone; student1 and supervisor1 tokens | `GET …/grade` as student1 (raw body checked), as supervisor1; release; `GET` as student1 | student: exactly `{ grade: null, released: false, releasedAt: null }`, raw text has no `85` / `score`; supervisor: full grade; after release student gets score and version | same file › TEST-08-05 |
| TEST-08-06 | AC-08-06 | API + DB | Alpha milestone with a submission; Beta milestone with a submission | student1 `PUT`/release; supervisor2 `GET`/`PUT`/release and student3 `GET` on Alpha; no token on all three; supervisor1 `PUT` (control); supervisor2 `PUT` on Beta | 403 / 403; 404 ×4; 401 ×3; no grade row on Alpha from those calls; controls 200 | same file › TEST-08-06 |
| TEST-08-07 | AC-08-07 | API + DB | Alpha milestone with v1; another Alpha milestone with v1 and v2 | each invalid body; `{ score: 50, version: 2 }` on the first milestone | 400 with the expected `details`; `version: NOT_FOUND`; no `Grade` row | same file › TEST-08-07 |
| TEST-08-08 | AC-08-07 | Unit | — | `validateGradeInput` (`server/src/utils/validation.ts`) boundaries | 0 and 100 ok; −1, 101 `OUT_OF_RANGE`; 85.5, `"85"` `INVALID_TYPE`; missing `REQUIRED`; version 0, 1.5, `"1"` `INVALID_TYPE`; missing version `REQUIRED` | `server/tests/unit/grade-validation.test.ts` › TEST-08-08 |
| TEST-08-09 | AC-08-08 | UI | Mocked API: supervisor; milestone 10 with v1, v2; grade state not graded | Enter 85, Save grade; then Release grade | PUT body `{ score: 85, version: 2 }`; card text `85 / 100 (graded on Version 2)` and "Not released"; after release `Released:` text and no Save grade button | `client/tests/Grades.test.tsx` › TEST-08-09 |
| TEST-08-10 | AC-08-08 | UI | Mocked API: PUT answers 409 `GRADE_RELEASED` | Save grade | Alert with the API message in the Grade card | same file › TEST-08-10 |
| TEST-08-11 | AC-08-09 | UI | Mocked API: student; unreleased state, then a released grade | Render `/student/milestones/10` twice | "Grade not released"; then `85 / 100 (graded on Version 1)` | same file › TEST-08-11 |
| TEST-08-12 | AC-08-10 | UI | Mocked API: supervisor; milestone 10 with v1, v2; stored unreleased grade `80` on Version 2 | Verify unchanged **Release grade** enabled; edit **Score** to `95` → clear to `""` → revert to `80`; edit **Graded version** to `1` → edit **Score** to `92` → **Save grade** → **Release grade** (dynamic release state) | **Release grade** disabled, `0` release calls, and `"Save the grade before releasing"` rendered after `.form-actions` on changed **Score**, empty **Score**, and changed **Graded version**; reverting re-enables **Release grade**; saving sends `PUT { score: 92, version: 1 }` and shows `92 / 100 (graded on Version 1)`, then releasing shows `Released:` and `92 / 100 (graded on Version 1)` | same file › TEST-08-12 |
| TEST-08-13 | AC-08-10 | UI | Mocked API: supervisor; stored unreleased grades `80` on v2 and `0` on v2 | Enter `"080"`, `"80.0"`, `"8e1"` and save `"080"`; on `0`, enter `"00"` / `"-0"` and clear to `""` | Equivalent numeric score forms keep **Release grade** enabled without the unsaved notice before and after Save `200`; empty `""` on stored `0` keeps **Release grade** disabled with notice | same file › TEST-08-13 |
| TEST-08-14 | AC-08-10 | UI | Mocked API with deferred `PUT` and `POST .../release` promises; stored unreleased grade `80` on v2 | Trigger **Save grade** (on `95`) and inspect controls before resolve; resolve then trigger **Release grade** and inspect controls before resolve | Both **Score** and **Graded version** inputs plus action buttons are `disabled` while either request is in flight | same file › TEST-08-14 |

Existing tests that render the milestone pages (`Submissions.test.tsx`, `Feedback.test.tsx`, `MilestoneEdit.test.tsx`) do not mock the grade endpoint; the page must keep working when the grade request returns nothing useful, so these tests stay unchanged.

## 8. Definition of Done and evidence

- [x] All AC-08-01..AC-08-09 implemented
- [x] Migration `20261121092553_f08_grades` (with the hand-added `Grade_score_range` check) applied on a fresh test database by the test global setup; all STS tests executed and passing on `249bc1a`: `npm run build` OK; `npm test` server 116 passed (F-08: 7 API + 1 unit), client 26 passed (F-08: 3), 0 failed, 0 skipped; `npm run test:e2e` 4 passed (after `npx prisma migrate deploy` on the local dev database: the first E2E run failed 3 tests with "The column `Milestone.gradesReleasedAt` does not exist" because the dev database did not have the new migration yet); `python -m unittest discover -s deploy/tests` 17 OK. CI `test-and-docker`: recorded on the PR
- [x] TDD red → green: failing tests `b616439` (tests only) on `517f3a4`: build OK; server 8 failed — 7 API with `404` because the grade routes did not exist (each negative case carries a positive control), 1 unit `validateGradeInput is not a function`; client 3 failed — no "Grade" region → implementation `249bc1a` (all pass). Contract v0.2 corrected AC-08-06 before the test commit (student3's `PUT`/release get 403 by role)
- [x] SRS BR-11 (v0.8), System SDS (v0.9), `docs/traceability.md` (v2.0), `docs/features.md` (v1.4) updated
- [ ] PR reviewed by phet526 (approve before merge) and merged into `sprint-2`

### 8.1 Defect `#93` (`DEF-GRADE-RELEASE`) follow-up verification

- [x] Owner triage posted on `#93` (`issuecomment-7080702373`), F-08 contract updated (`0.4`–`0.7`, `AC-08-10`, `TEST-08-12..14`), and `docs/traceability.md` (`2.14`, `2.15`) updated
- [x] TDD RED → GREEN on `fix/F-08-release-unsaved-grade`:
  - Round 1: Contract `0.4` (`38f89ca`) → RED (`6cd2e11`, test only: `Grades.test.tsx` `1 failed | 3 passed (4)`, CI `45034210203` client `1 failed / 33 passed (34)` at `TEST-08-12` `expect(element).toBeDisabled()`) → GREEN (`f5a0912`, CI `45034474980`, `201 / 201` passed: `deploy/tests` `17`, server `22` files / `145` passed, client `11` files / `34` passed including `TEST-08-12`, Playwright E2E `5` passed in `15.1s`, Docker build OK; local `npm run build`, server unit `41/41`, client `34/34` also passed); synced with `sprint-3` @ `9aebc93` at `8114740` (CI `45040940899`, `224 / 224` passed)
  - Round 2 (PR #97 review): Contract `0.6` (`92e3c18`) → RED (`25b0e18`, tests only: local client `3 failed | 39 passed (42)`, `Grades.test.tsx` `3 failed | 3 passed (6)` on DOM position of notice, equivalent scores `"80.0"`/`"8e1"`/`"080"`, and `isBusy` inputs) → GREEN (`36d0d99`, CI `45044529526`, `226 / 226` passed in `2m12s`: `deploy/tests` `17`, server `24` files / `162` passed, client `12` files / `42` passed incl. `TEST-08-12..14`, Playwright E2E `5` passed in `13.7s`, Docker build OK; local `npm run build`, server unit `44/44`, client `42/42` also passed)
- [ ] PR reviewed by `@ILoveSiesta` and merged into `sprint-3`
