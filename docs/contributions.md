# Contribution Table

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |
| 0.2 | 2026-11-06 | ILoveSiesta | Sprint 1 contributions (issues #1–#6, #13, #15; PRs #7–#12, #14) |
| 0.3 | 2026-11-14 | phet526 | Lab 5 contributions (issues #18–#22; PRs #23–#25, #39–#45, and final release) |
| 0.4 | 2026-11-21 | ILoveSiesta | Lab 6 contributions as in the Lab 6 report §D.5 (issues #48, #49, #52, #54, #56; PRs #50, #51, #53, #55, #57, #58) (#60) |
| 0.5 | 2026-11-21 | ILoveSiesta | Sprint 2 and Lab 7 contributions so far (issues #59, #60, #62–#68, #79; PRs #61, #69, #71–#78) (#79) |
| 0.6 | 2026-11-23 | ILoveSiesta | `v0.2.0` release and post-deployment checks completed; Sprint 3 and the defect fixes up to the release candidate `v0.3.0` (issues #70, #81, #83–#85, #89, #90, #92–#94, #100, #102, #103, #107; PRs #80, #82, #86–#88, #91, #97–#99, #101, #104–#106) (#107) |

Sources: GitHub issues and PRs (author, reviewer, merged by) and `git log` on `sprint-1` (Sprint 1 and Lab 6), `lab5-staging` / `main` (Lab 5), `sprint-2` (Sprint 2, Lab 7 change) and `sprint-3` (Sprint 3, Lab 7 records). Both students
worked on requirements/design, tests, implementation and review; issues alternated between
them, and the student who did not write an issue reviewed its PR.

## Sprint 1

| Student | Requirements / design | Tests | Implementation | Reviews | Deployment / maintenance |
|---|---|---|---|---|---|
| ILoveSiesta | SRS, feature inventory, traceability, System SDS and three-sprint plan (#1, PR #7); F-02 and F-04 contracts; shared UI styling CHG-01 (#3) and its record (#13, PR #14) | F-02 and F-04 unit/API/UI tests (TDD red → green); test database `cpms_test` setup used by all server tests | Project skeleton; F-02 team view and milestone creation (#3, PR #9); F-04 feedback (#5, PR #11); shared stylesheet; release preparation (#15) | PR #8 F-01 (2× request changes, then approve); PR #10 F-03 (request changes, then approve); PR #12 E2E (request changes, comment, then approve) | Not started in Sprint 1 (Docker, CI/CD and GCP are Lab 5) |
| phet526 | Reviewed and agreed decisions D-01..D-09 in the baseline (PR #7); F-01, F-03 and E2E contracts | F-01 and F-03 unit/API/UI tests (TDD red → green); Playwright E2E journeys TEST-E2E-01/02 (#6, PR #12) | F-01 authentication, team data and seed (#2, PR #8); F-03 submissions and versions (#4, PR #10) | PR #7 baseline, PR #9 F-02, PR #11 F-04, PR #14 CHG-01 (approve; merged after review) | Not started in Sprint 1 (Docker, CI/CD and GCP are Lab 5) |

## Lab 5 (CI/CD, Docker, GCP)

| Student | Issues owned / delivered | Implementation & Automation | Live GCP & Pipeline Evidence | Reviews & Merge Gate |
|---|---|---|---|---|
| **ILoveSiesta** | #18 Cloud-ready app & Docker (PR #23)<br>#21 Merge gate & deploy pipeline (PR #41, #42, #43, #44, #45) | Dockerfile & compose (Node 24 alpine, root app); environment `demo`, ruleset `protect-main`, Deploy demo workflow (`deploy.yml`), single-manifest build fix (`--provenance=false --sbom=false`), visible version in footer | Merge gate proof with deliberate failing test (PR #40, C-02); Release 1 & Release 2 pipeline deployments (C-06, runs 43462038722 & 43470205241); tag `v0.1.1` | Reviewed & approved PR #24 (CI/deploy scripts), PR #39 (GCP/WIF), and PR #46 (final docs); merged PR #25 (Lab 5 release of #19 to main) |
| **phet526** | #19 CI & deploy scripts (PR #24)<br>#20 GCP project & WIF (PR #39)<br>#22 Persistence, rollback & final docs | GitHub Actions CI (`ci-docker.yml`), CPMS deployment automation scripts (`deploy/` deploy, release, smoke, teardown), offline unit tests (`deploy/tests/*`); GCP project initialization (`cpe334-cpms`), Cloud SQL instance `cpms-pg`, Secret Manager secrets, WIF pool/provider; final `deployment.md` §7, pause/resume procedure | Live CI run evidence (C-01, run 43234818752); first Cloud Run deployment from Cloud Shell & C-04 live UI verification; data persistence verification across container restart, rollback to Release 1 and roll-forward to Release 2 (C-05, runs 43476893936 & 43477461502) | Reviewed & approved PR #23 (Docker), PR #41 (Deploy demo), PR #42 (Release 1 to main), PR #43 (Deploy proof), PR #44 (Release 2 to main), PR #45 (Release 2 docs); merged PRs with merge commits |

## Lab 6 (cross-team UAT and defect management)

| Work | ILoveSiesta | phet526 |
|---|---|---|
| Part A (Product Team) | #48 PR #50 (CI on `sprint-1`); #49 PR #51 wrote `uat-plan.md` v0.1–0.2 and the local dry-run; #56 PR #57 v0.4 | Reviewed and merged PR #50 and PR #51; dry-ran the 7 cases by hand on the public URL; sent the passwords to the partner team privately; v0.3 (PR #53) |
| Part B (UAT Team) | Ran UAT-01..03 of YMOM and captured the screenshots; selected the screenshots and packaged the evidence sent to the partner team | Ran UAT-04..06 of YMOM; checked the YMOM contracts and ran UAT-ADD-01/02 |
| Part C | Reviewed the triage and PR #53, PR #55; recorded the findings in both directions | Triaged #52 (not-defect) and #54 (accepted Minor); reported YMOM #60 and #59 |
| Part D | Reviewed PR #55 (ran RED/GREEN, E2E, checked 1280/375 px) and merged it; RED/GREEN footer in PR #57; opened release PR #58, tag `v0.1.2`; retested YMOM #60/#59 | Wrote RED `044ea2a` and GREEN `d4590dc` (PR #55); reviewed and merged PR #57 and PR #58; checked Deploy demo and the URL after deployment |
| Pair work | Decided the YMOM acceptance together before sending it; coordinated test times and deployment notices with the partner team; produced the Lab 6 report PDF | (same) |

## Sprint 2 and Lab 7 change (`v0.2.0`)

Source: GitHub issues #59–#68, #79 and PRs #61, #69, #71–#78, #80 (author, reviewer, merged by) on `sprint-2` and `main`. The Lab 7
metrics, release readiness and retrospective (#70) are in the Sprint 3 table below.

| Work | ILoveSiesta | phet526 |
|---|---|---|
| Setup | #60 PR #61: `sprint-2` staging, CI trigger, plan v0.6, Lab 6 documents brought in line with the Lab 6 report | Reviewed and merged PR #61 |
| Requirements / design | F-05, F-06, F-08 contracts (BR-13 and BR-11 detailed in the SRS); agreed decisions G1–G7 for grades with phet526 in #66 | F-07, F-09 and AC-01-10 contracts (BR-12 detailed in the SRS); agreed the F-09 status options with ILoveSiesta in #67 (Option A) |
| Tests and implementation (TDD) | F-05 (#62, PR #69), F-06 (#63, PR #73), F-08 (#66, PR #76): tests-only RED commit, then implementation | F-07 (#64, PR #75), F-09 (#67, PR #77): tests-only RED commit, then implementation; TEST-01-14 for AC-01-10 (#65, PR #74) |
| Reviews | PR #74 (mutation check of TEST-01-14, approve, merge); PR #75 (request changes for the Edit milestone layout and the revision numbers, then approve, merge); PR #77 (RED re-run, long-title layout check at 1024/375 px, approve, merge) | Reviewed, approved and merged PR #69, #71, #72, #73, #76 |
| Lab 7 change #59 (BR-05 7-day window) | Wrote the change request, sent it and the clarification to the TA, recorded the approval; contract revision and impact analysis (PR #71); RED → GREEN (PR #72) | Reviewed the contract revision before any code (PR #71) and the RED → GREEN PR (PR #72), and merged both |
| Release | #79 (PR #78): footer `CPMS v0.2.0` RED → GREEN, Sprint 2 completion table (`docs/sprints/sprint-2/README.md`), regression on the release-prep commit; #68: release PR #80 to `main`, tag `v0.2.0`, signed-in post-deployment checks PD-01..PD-18 (comment 7065312117 in #68) | Reviewed and merged PR #78 and the release PR #80; Lab 7 post-deployment checks on `v0.2.0` (milestone 22 inserted with the TA's approval, `409 SUBMISSION_WINDOW_CLOSED`, preserved Sprint 1 path; #59) |
| Pair work | Planned the Sprint 2 split and the order of the parallel PRs; resolved revision-number conflicts between parallel PRs (the author who merged later renumbered) | (same) |

## Sprint 3, Lab 7 records and defect fixes (up to the `v0.3.0` release preparation)

Source: GitHub issues #70, #81, #83–#85, #89, #90, #92–#94, #100, #102, #103, #107 and PRs #82, #86–#88, #91, #97–#99,
#101, #104–#106 (author, reviewer, merged by) on `sprint-3`. Every PR was approved by the other student before it was merged.

| Work | ILoveSiesta | phet526 |
|---|---|---|
| Setup | #81 PR #82: `sprint-3` staging, CI trigger, plan v0.7 | Reviewed and merged PR #82 |
| Sprint 3 contracts | F-10, F-11, F-12 contracts with AC and STS, including the NFR-10 measurement plan (#84, PR #87) | Reviewed and merged PR #87, with notes for the F-11/F-12 implementation; F-13 contract (#83) |
| Sprint 3 implementation (TDD) | — | F-13 team management (#83, PR #88): contract → RED → implementation, and RED → fix rounds for the review findings |
| Lab 7 records | Reviewed PR #86 (2× request changes for the metric snapshot, CI counts and interpretation, then approve) and merged it | Metrics, release readiness, technical debt and retrospective (#70, PR #86) |
| Whole-system audit | Audited `v0.2.0` / `sprint-3` and opened the defect issues #92–#94 | — |
| Defect fixes (triage, contract revision, RED → GREEN) | #89 (PR #98), #94 three IDs (PR #104), #100 (PR #101), #103 (PR #106) | #90 (PR #91), #92 (PR #99), #93 (PR #97), #102 (PR #105) |
| Reviews | PR #88 (5× request changes, then approve); PR #91 (3×), PR #97 (2×), PR #99 (2×), PR #105 (2×), each then approved; merged all of them | Reviewed, approved and merged PR #98, #101, #104, #106 |
| Release candidate | #107: footer `CPMS v0.3.0` RED → GREEN, change register, Sprint 3 README and remaining-work plan, SRS/features/SDS/traceability updates, regression; #85: release PR and deployment | Reviews #107 and the release PR; signed-in post-deployment checks on `v0.3.0` (#85) |
| Pair work | Agreed the split of the defect issues and the order of the parallel PRs; renumbered document revisions when parallel PRs collided (the author who merged later renumbered) | (same) |

AI assistance is declared in [`ai-use.md`](ai-use.md).
