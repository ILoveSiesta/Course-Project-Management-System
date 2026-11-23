# Sprint 3 Contracts, Progress and Remaining Work

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-23 | ILoveSiesta | Sprint 3 status at the release candidate `v0.3.0` (#107): contracts, implemented progress, defect fixes, Product Definition of Done and the remaining-work plan to 13 Dec |

Staging branch: `sprint-3`, opened from the Sprint 2 release `v0.2.0` (`7c3a970`) on 2026-11-21 (#81, PR #82). It
stays open until the final release `v1.0.0`. Scope and dates: [`../plan.md`](../plan.md) v0.7. Findings and
their status: [`../../change-register.md`](../../change-register.md).

Status values: **Planned** (contract only), **In progress**, **Implemented** (merged into `sprint-3`), **Tested**
(its STS tests pass on the release-candidate head), **Accepted** (independent acceptance on a deployed release).

## 1. Contracts, issues and reviewed PRs

Each contract was committed before its tests and implementation. Every PR targets `sprint-3`, was approved by
the other student before merging, and was merged with a merge commit.

| Feature / work | Contract | Issue | PR | Author → reviewer | Merge commit on `sprint-3` |
|---|---|---|---|---|---|
| Setup: `sprint-3` staging, CI trigger, plan v0.7 | — | #81 | #82 | ILoveSiesta → phet526 | `4767ef5` |
| Lab 7 records (metrics, release readiness, debt, retrospective) | — | #70 | #86 | phet526 → ILoveSiesta | `85deef2` |
| F-13 Team management | [`F-13-team-management.md`](F-13-team-management.md) (v0.1–v0.12 in #83; v0.13–v0.14 in #102) | #83 | #88 | phet526 → ILoveSiesta (5 rounds of requested changes, then approve) | `c553148` |
| F-10 Progress board, F-11 Summary report, F-12 Submission filter (contracts only) | [`F-10-progress-board.md`](F-10-progress-board.md) v0.2, [`F-11-summary-report.md`](F-11-summary-report.md) v0.1, [`F-12-submission-filter.md`](F-12-submission-filter.md) v0.2 | #84 | #87 | ILoveSiesta → phet526 | `8f92f5a` |
| Defect fixes #89, #90, #92, #93, #94, #100, #102, #103 | Revisions of the affected contracts (see the register) | see register | #98, #91, #99, #97, #104, #101, #105, #106 | see register | `9b05789`, `9aebc93`, `77ef742`, `1c92061`, `326e66a`, `910a424`, `cef176a`, `f0041ff` |
| Release preparation (this file, register, documents, footer `CPMS v0.3.0`) | — | #107 (split from #85) | this PR | ILoveSiesta → phet526 | — |
| Release `sprint-3` → `main`, tag `v0.3.0`, deployment checks | — | #85 | release PR | ILoveSiesta → phet526 | (on `main`) |

## 2. Sprint 3 feature status

| Feature | Requirements | AC | Status | Evidence |
|---|---|---|---|---|
| F-13 Team management | FR-07, BR-10, BR-14, NFR-08 | AC-13-01..AC-13-15 | **Tested** (acceptance on the deployed `v0.3.0` planned in #85) | Contract `26b20bc` → RED `eae26bf` (server 11 failed: routes and validation functions missing) → implementation `0f39b85`. Fixes found in review followed the same order: RED `a1632b9` (case-insensitive duplicate names, INT4 ids, concurrent creation) and RED for TEST-13-19 (`cpms-migrate` seed re-run restoring removed memberships) before each fix. TEST-13-01..TEST-13-20 pass on `1397c2e` (CI 45005779308); TEST-13-21 (#94) and TEST-13-22 (#102) added later. E2E `e2e/f13-team-management.spec.ts` |
| F-10 Progress board | FR-21 | AC-10-01..AC-10-07 | **Planned** (contract v0.2) | TEST-10-01..TEST-10-08 specified, not implemented |
| F-11 Summary report | FR-22, NFR-10 | AC-11-01..AC-11-08 | **Planned** (contract v0.1, including the NFR-10 measurement plan) | TEST-11-01..TEST-11-09 specified, not implemented |
| F-12 Submission filter | FR-23 | AC-12-01..AC-12-08 | **Planned** (contract v0.2) | TEST-12-01..TEST-12-08 specified, not implemented |
| SR-05 Performance (NFR-10) | NFR-10 | AC-11-08 | **Planned** | Measured with F-11 (`npm run test:perf`) |
| SR-06 Responsive UI (NFR-11) | NFR-11 | AC-10-07, AC-11-07, AC-12-08 + existing screens | **In progress**: #54 wrapping E2E and the #103 E2E at 320/375 px; no viewport suite for every screen | `e2e/issue54-text-wrapping.spec.ts`, `e2e/f08-grade-double-click.spec.ts` |

**Hardening in Sprint 3:** eight defect issues with eleven finding IDs were triaged, revised in the contracts,
fixed test-first and reviewed in Sprint 3 (register §3). Their re-test on the deployed release is part of #85.

## 3. Sprint 1 continuity

The original Sprint 1 critical journey (TEST-E2E-01) and the rejection journey (TEST-E2E-02) run in
`npm run test:e2e` on the release-preparation code: 15 passed in each of 3 runs (§4). The same journey is checked by hand on the public URL
after `v0.3.0` is deployed (#85).

## 4. Product Definition of Done (release candidate)

Checked on `chore/v0.3.0-rc-prep` (#107). The same checks are run again on the release commit on `main` (#85).

- [x] Sprint 2 features complete (`v0.2.0`); Sprint 3 contracts for every remaining baseline feature (F-10..F-13)
- [x] At least one Sprint 3 workflow implemented and tested: F-13 team management
- [x] Contracts committed before tests, tests before implementation, for F-13 and every defect fix (§1, register)
- [x] Teammate-reviewed PRs merged into `sprint-3` with passing CI `test-and-docker`
- [x] Integration checks on the release-preparation code (`3143200` = `sprint-3` `f0041ff` + the footer change; the rest of #107 is documents only): `npm run build` OK; `npm test` server **210 passed** (30 files) and client **65 passed** (17 files); `npm run test:e2e` **15 passed** in each of 3 runs on a throwaway database (ports 3197/5197, including TEST-E2E-01/02); `python -m unittest discover -s deploy/tests` **17 OK**; 0 failed, 0 skipped
- [x] Documents current: SRS, features, System SDS, traceability, contracts, change register, contribution table, AI-use declaration
- [ ] Release PR `sprint-3` → `main` reviewed and merged, tag `v0.3.0`, Deploy demo run green, post-deployment checks and defect re-tests on the public URL (#85)

## 5. Remaining work to the final release (13 Dec)

Owners and dates are the team's plan at the release candidate, built around the final examinations on
1–11 Dec. The main product workflows that remain (F-10..F-12) are scheduled before the exams start. The last
two days are kept for the release, the video and the PDF only.

| Item | Current status (tested commit) | Remaining action | Owner | Depends on | Target |
|---|---|---|---|---|---|
| #85 release `v0.3.0` | Release preparation in #107 | Release PR, tag, deploy; post-deployment checks; re-test the fixed defects (#89, #90, #92–#94, #100, #102, #103) and the Lab 7 rule on `v0.3.0`; F-13 membership across a redeploy that runs the migrate job (NFR-08) | ILoveSiesta (release), phet526 (review, signed-in checks) | #107 merged | 28 Nov |
| F-10 Progress board (AC-10-01..07) | Planned, contract v0.2 | Issue, RED (TEST-10-01..08), implementation, review | phet526 | F-09 (done) | 2 Dec |
| F-12 Submission filter (AC-12-01..08) | Planned, contract v0.2 | Settle the open questions from the PR #87 review (empty query values; `isLatest` across all versions) in the contract, then RED (TEST-12-01..08), implementation, review | ILoveSiesta | F-09 (done) | 2 Dec |
| F-11 Summary report + NFR-10 (AC-11-01..08) | Planned, contract v0.1 | Settle the `groupBy` note from the PR #87 review in the contract; RED (TEST-11-01..09), implementation, `npm run test:perf` against the 20 × 10 × 3 dataset | ILoveSiesta | F-08, F-09 (done) | 4 Dec |
| NFR-11 viewport checks (TD-03) | In progress (two E2E specs at phone width) | Playwright journeys of the main screens at 375 px and 1280 px | phet526 | F-10..F-12 merged | 6 Dec |
| TD-01 browser E2E for Sprint 2 and 3 screens | E2E covers Sprint 1, #54, F-13 and #103 | One E2E journey through F-05..F-09 and F-10..F-12 | ILoveSiesta | F-10..F-12 merged | 6 Dec |
| TD-02 NFR-05 forced 5xx shape | Shape checked for unexpected errors by TEST-90-13 (#90) | Confirm coverage in the traceability; add a test only if a gap remains | phet526 | — | 6 Dec |
| E2E TEST-13-15 intermittent "Failed to fetch" (1 of 69 runs on `c553148`) | Not reproduced in 63 further runs | Watch in every regression; open a defect with the run log if it happens again | phet526 | — | each release |
| Independent UAT re-test (Final §3.4) | Lab 6 cases UAT-01..07 accepted on `v0.1.2` | Ask the partner team to re-run the affected UAT cases on the final candidate; fix and re-test findings | ILoveSiesta, phet526 | Final candidate deployed | 10 Dec |
| Final release `v1.0.0`, demonstration video, final PDF | — | Release PR, deploy, post-deployment checks; video with both students; final report | ILoveSiesta, phet526 | All items above | 12–13 Dec |

## 6. Known limitations at the release candidate

| Item | Impact | Planned |
|---|---|---|
| F-10, F-11, F-12 not implemented (contracts only) | No progress board, summary report or submission filter in `v0.3.0` | §5 |
| NFR-10 not measured | Response times with the NFR-10 data size are not shown | §5 (with F-11) |
| Responsive layout checked by E2E only for the #54 card wrapping and the F-08 Grade card | Other screens are not checked automatically at 375 px | §5 (NFR-11) |
| E2E tests and local browser checks leave timestamped data in the dev database | Repeated runs add milestones, submissions and teams to the dev data | Accepted (as in Sprints 1 and 2) |
