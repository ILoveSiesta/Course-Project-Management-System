# Contribution Table

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |
| 0.2 | 2026-11-06 | ILoveSiesta | Sprint 1 contributions (issues #1–#6, #13, #15; PRs #7–#12, #14) |
| 0.3 | 2026-11-14 | phet526 | Lab 5 contributions (issues #18–#22; PRs #23–#25, #39–#45, and final release) |

Sources: GitHub issues and PRs (author, reviewer, merged by) and `git log` on `sprint-1`. Both students
worked on requirements/design, tests, implementation and review in Sprint 1; issues alternated between
them, and the student who did not write an issue reviewed its PR.

## Sprint 1

| Student | Requirements / design | Tests | Implementation | Reviews | Deployment / maintenance |
|---|---|---|---|---|---|
| ILoveSiesta | SRS, feature inventory, traceability, System SDS and three-sprint plan (#1, PR #7); F-02 and F-04 contracts; shared UI styling CHG-01 (#3) and its record (#13, PR #14) | F-02 and F-04 unit/API/UI tests (TDD red → green); test database `cpms_test` setup used by all server tests | Project skeleton; F-02 team view and milestone creation (#3, PR #9); F-04 feedback (#5, PR #11); shared stylesheet; release preparation (#15) | PR #8 F-01 (2× request changes, then approve); PR #10 F-03 (request changes, then approve); PR #12 E2E (request changes, comment, then approve) | Not started in Sprint 1 (Docker, CI/CD and GCP are Lab 5) |
| phet526 | Reviewed and agreed decisions D-01..D-09 in the baseline (PR #7); F-01, F-03 and E2E contracts | F-01 and F-03 unit/API/UI tests (TDD red → green); Playwright E2E journeys TEST-E2E-01/02 (#6, PR #12) | F-01 authentication, team data and seed (#2, PR #8); F-03 submissions and versions (#4, PR #10) | PR #7 baseline, PR #9 F-02, PR #11 F-04, PR #14 CHG-01 (approve; merged after review) | Not started in Sprint 1 (Docker, CI/CD and GCP are Lab 5) |

## Lab 5 (CI/CD, Docker, GCP)

| Student | Issues owned / delivered | Implementation & Automation | Live GCP & Pipeline Evidence | Reviews & Merge Gate |
|---|---|---|---|---|
| **ILoveSiesta** | #18 Cloud-ready app & Docker (PR #23)<br>#21 Merge gate & deploy pipeline (PR #41, #42, #43, #44, #45) | Dockerfile & compose (Node 24 alpine, root app); environment `demo`, ruleset `protect-main`, Deploy demo workflow (`deploy.yml`), single-manifest build fix (`--provenance=false --sbom=false`), visible version in footer | Merge gate proof with deliberate failing test (PR #40, C-02); Release 1 & Release 2 pipeline deployments (C-06, runs 43462038722 & 43470205241); tag `v0.1.1` | Reviewed & approved PR #24 (CI/deploy scripts), PR #39 (GCP/WIF), and PR for #22 (final docs) |
| **phet526** | #19 CI & deploy scripts (PR #24)<br>#20 GCP project & WIF (PR #39)<br>#22 Persistence, rollback & final docs | GitHub Actions CI (`ci-docker.yml`), CPMS deployment automation scripts (`deploy/` deploy, release, smoke, teardown), offline unit tests (`deploy/tests/*`); GCP project initialization (`cpe334-cpms`), Cloud SQL instance `cpms-pg`, Secret Manager secrets, WIF pool/provider; final `deployment.md` §7, pause/resume procedure | Live CI run evidence (C-01, run 43234818752); first Cloud Run deployment from Cloud Shell & C-04 live UI verification; data persistence verification across container restart, rollback to Release 1 and roll-forward to Release 2 (C-05, runs 43476893936 & 43477461502) | Reviewed & approved PR #23 (Docker), PR #41 (Deploy demo), PR #43 (Deploy proof), PR #44 (Release 2), PR #45 (Release 2 docs); merged PRs with merge commits |

AI assistance is declared in [`ai-use.md`](ai-use.md).
