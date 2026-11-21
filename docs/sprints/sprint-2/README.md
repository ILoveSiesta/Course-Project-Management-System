# Sprint 2 Engineering Contracts and Completion

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-21 | ILoveSiesta | Contract index, Sprint 2 completion table, Lab 7 maintenance change, Product Definition of Done and known limitations for the Sprint 2 release `v0.2.0` (#68) |

One contract per feature, committed **before** the tests and the implementation (`docs(F-XX): contract` →
`test(F-XX)` → `feat(F-XX)`). Staging branch: `sprint-2`, opened from the accepted Sprint 1 release `v0.1.2`
(`9dd9239`) on 2026-11-21 (#60, PR #61). Scope and dates: [`../plan.md`](../plan.md) v0.6.

## 1. Contracts, issues and reviewed PRs

Every PR targets `sprint-2`, was approved by the other student before merging, and was merged with a merge commit.

| Feature | Contract | Issue | PR | Author → reviewer (approved and merged) | Merge commit on `sprint-2` |
|---|---|---|---|---|---|
| F-05 Edit milestone / extend deadline | [`F-05-milestone-edit.md`](F-05-milestone-edit.md) v0.3 | #62 | #69 | ILoveSiesta → phet526 | `41e7284` |
| F-06 Milestone for several teams | [`F-06-multi-team-milestone.md`](F-06-multi-team-milestone.md) v0.2 | #63 | #73 | ILoveSiesta → phet526 | `517f3a4` |
| F-07 Revision history | [`F-07-revision-history.md`](F-07-revision-history.md) v0.2 | #64 | #75 | phet526 → ILoveSiesta (request changes, then approve) | `7840ad9` |
| F-08 Grades and release | [`F-08-grades.md`](F-08-grades.md) v0.3 | #66 | #76 | ILoveSiesta → phet526 | `ce9701d` |
| F-09 Team–milestone status | [`F-09-milestone-status.md`](F-09-milestone-status.md) v0.2 | #67 | #77 | phet526 → ILoveSiesta | `1da45f5` |
| AC-01-10 idempotent seed (Sprint 1 known limitation) | [`../sprint-1/F-01-auth.md`](../sprint-1/F-01-auth.md) v0.4 | #65 | #74 | phet526 → ILoveSiesta | `022acea` |
| Setup: `sprint-2` staging, CI trigger, plan v0.6, Lab 6 documents | — | #60 | #61 | ILoveSiesta → phet526 | `891d8ce` |
| Release preparation: footer `CPMS v0.2.0`, this file, contributions, AI use | — | #68 | this PR | ILoveSiesta → phet526 | — |

## 2. Sprint 2 feature completion

"Executed verification" lists the STS tests of each contract; all of them run in `npm test` (server and client) on
every PR and on the release commit. RED = the tests-only commit run on the code before the feature.

| Feature | AC | Implementation (GREEN) | TDD evidence (RED → GREEN) | Executed verification | Result | Accepted release |
|---|---|---|---|---|---|---|
| F-05 | AC-05-01..AC-05-09 | `fdfdff4`: `PATCH /api/milestones/:id`, extend-only deadline (BR-13, `409 DEADLINE_NOT_EXTENDED`), Edit milestone form | RED `931814a`: server 12 failed (route missing, `validateMilestoneUpdate is not a function`), client 2 failed | TEST-05-01..TEST-05-10 — `server/tests/api/milestone-edit.api.test.ts`, `server/tests/unit/milestone-update-validation.test.ts`, `client/tests/MilestoneEdit.test.tsx` | PASS | `v0.2.0` |
| F-06 | AC-06-01..AC-06-08 | `997b7d1`: `POST /api/milestones` for 1–20 assigned teams, all or nothing in one transaction, Teams checkboxes | RED `29ac32c`: server 6 failed (route missing, `validateTeamIds is not a function`), client 2 failed | TEST-06-01..TEST-06-09 — `server/tests/api/multi-team-milestone.api.test.ts`, `server/tests/unit/team-ids-validation.test.ts`, `client/tests/MultiTeamMilestone.test.tsx` | PASS | `v0.2.0` |
| F-07 | AC-07-01..AC-07-07 | `9751f0f`: `GET /api/milestones/:id/history` (`?order=desc\|asc`), Revision history screen; layout fix `060402c` after review | RED `38f7515`: server 6 failed (route missing, `parseHistoryOrder is not a function`), client 2 failed | TEST-07-01..TEST-07-08 — `server/tests/api/revision-history.api.test.ts`, `server/tests/unit/revision-history.test.ts`, `client/tests/RevisionHistory.test.tsx` | PASS | `v0.2.0` |
| F-08 | AC-08-01..AC-08-09 | `249bc1a`: `Grade` model + migration `20261121092553_f08_grades` (score 0–100 check), grade/release endpoints, Grade cards | RED `b616439`: server 8 failed (routes missing, `validateGradeInput is not a function`), client 3 failed | TEST-08-01..TEST-08-11 — `server/tests/api/grades.api.test.ts`, `server/tests/unit/grade-validation.test.ts`, `client/tests/Grades.test.tsx` | PASS | `v0.2.0` |
| F-09 | AC-09-01..AC-09-07 | `31949c8`: derived `status` on every milestone response (never stored), badges on the milestone lists | RED `f9eab65`: server 6 failed (`status` undefined, `deriveMilestoneStatus is not a function`), client 2 failed | TEST-09-01..TEST-09-08 — `server/tests/api/milestone-status.api.test.ts`, `server/tests/unit/milestone-status.test.ts`, `client/tests/MilestoneStatus.test.tsx` | PASS | `v0.2.0` |
| AC-01-10 (#65) | AC-01-10 | No code change: the seed was already idempotent | Test-only (`bbda76d`); the seed already used upserts, so the test passed without a code change — verification of existing behaviour, not TDD evidence | TEST-01-14 — `server/tests/api/auth.api.test.ts` | PASS | `v0.2.0` |

No Sprint 2 feature was moved to Sprint 3. "Accepted release" is the first `main` release that contains the
merged PR; its tag, release commit, CI run and deployed Cloud Run revision are recorded in #68 and in the GitHub
Release `v0.2.0`.

## 3. Maintenance change (Lab 7, #59) — kept separate from the Sprint 2 features

| Step | Evidence |
|---|---|
| Change | BR-05 rev. / CHG-03: late submissions accepted for at most 7 × 24 h after the deadline, later ones rejected with `409 SUBMISSION_WINDOW_CLOSED` |
| Approval | TA Kantapat Suwannahong, 2026-11-21 13:20 ICT (recorded in #59) |
| Accepted Sprint 1 baseline / pre-change commit | `v0.1.2` (`9dd9239`) / `c82a867` (BR-05 code identical to `9dd9239`) |
| Contract revision, reviewed before code | PR #71 → `c82a867` (SRS v0.7, F-03 contract v0.2, SDS v0.7, traceability v1.6, `docs/labs/lab-07/change-impact.md`) |
| RED → GREEN | PR #72 → `feaafdb`: RED `f5deaf7` (server 3 failed, client 1 failed) → GREEN `8259688` (TEST-03-18..TEST-03-24 pass) |
| Release | Same release `v0.2.0`; post-deployment check of the changed rule and of a preserved Sprint 1 path recorded in #59 |

## 4. Product Definition of Done (Sprint 2)

Checked on `chore/sprint-2-release-prep` at `d417afd` (2026-11-21) = `sprint-2` `1da45f5` + the footer change;
this PR adds documents only. The same checks are run again on the release commit on `main`.

- [x] Required behaviour implemented: F-05..F-09 (#62–#64, #66, #67), AC-01-10 (#65) and the Lab 7 change (#59)
- [x] Contracts committed before tests, tests before implementation, for every feature (table §2)
- [x] Teammate-reviewed PRs merged into `sprint-2` with passing CI `test-and-docker` (table §1)
- [x] Integration checks on staging (local, fresh test database): `npm run build` OK; `npm test` server 128/128 (20 files) and client 30/30 (10 files); `npm run test:e2e` 4/4; `python -m unittest discover -s deploy/tests` 17 OK; 0 failed, 0 skipped
- [x] Documents current: SRS v0.9, System SDS v0.11, features v1.6, traceability v2.2, contracts, contribution table, AI-use declaration
- [x] `sprint-2` contains `main` (`9dd9239` is an ancestor), so the release PR is up to date
- [ ] Release PR `sprint-2` → `main` reviewed and merged, tag `v0.2.0`, Deploy demo run green, post-deployment checks on the public URL (#68)

## 5. Known limitations and incomplete work

| Item | Impact | Planned |
|---|---|---|
| E2E (Playwright) still covers only the Sprint 1 journeys and the #54 text wrapping; Sprint 2 screens are covered by UI component tests and API tests, not by a browser journey | A break that appears only in the full browser flow of a Sprint 2 screen would not be caught by E2E | Post-deployment manual check of a Sprint 2 journey on `v0.2.0` (#68); Sprint 3 regression |
| F-09 status is shown on the milestone lists only, not on the milestone detail pages | Students and supervisors see the status on My team / team detail, not after opening a milestone | Contract F-09 §2.4 (deliberate); progress board F-10 in Sprint 3 |
| NFR-10 (p95 ≤ 500 ms for list/report endpoints) not measured; F-09 loads one latest submission per milestone in the same query, but no timing test exists | Performance with the NFR-10 data size is not shown | Sprint 3 (F-11 / NFR-10 smoke test) |
| Responsive layout (SR-06, NFR-11) checked by hand only for F-07 (review of PR #75) and F-09 (review of PR #77) | Other Sprint 2 screens are not checked at 375 px | Sprint 3 |
| Teams and memberships still come from the seed (FR-07, D-06) | Changing teams needs a database change | Sprint 3 (F-13) |
| E2E tests and local browser checks leave timestamped data in the dev database | Repeated runs add milestones and submissions to the dev data | Accepted (as in Sprint 1) |

Failed or skipped tests: none.
