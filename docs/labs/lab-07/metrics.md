# Lab 7: Engineering Metrics (`#70`)

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-22 | phet526 | Snapshot of five dated engineering metrics at `v0.2.0` (`7c3a970`, `cpms-00009-w5t`), source reconciliation tables, and ≤ 100-word interpretation (`#70`) |

- **Repository scope:** `ILoveSiesta/Course-Project-Management-System` only (`https://github.com/ILoveSiesta/Course-Project-Management-System`)
- **Snapshot timestamp:** `2026-11-22 00:05 ICT` (`2026-11-21 17:05 UTC`), immediately after PR `#82` merged into `sprint-3` (`4767ef5`)
- **Deployed production release in scope:** tag `v0.2.0` (`main` @ `7c3a970`, PR `#80`), Cloud Run revision `cpms-00009-w5t`, `Deploy demo` run `44915248527`

## 1. Engineering Metrics Summary

| ID | Metric | Definition | Observation Window / Snapshot | Value (Numerator / Denominator) | Evidence / Source |
|---|---|---|---|---|---|
| `M-01` | Completed Issues | Repository issues reaching `CLOSED` state out of all issues opened (`#1`–`#81`) | `2026-11-04` – `2026-11-22 00:05 ICT` | **29 / 30 (96.7%)**; `1` open (`#70`) | §2.1 below (`gh issue list --state all`) |
| `M-02` | Merged Pull Requests | Human feature/docs/release PRs merged into target branches (plus raw PR ratio including Dependabot `#26`–`#38`) | `2026-11-04` – `2026-11-22 00:05 ICT` | **38 / 39 human PRs merged (97.4%)**; `0` open; raw `38 / 52 (73.1%)` | §2.2 below (`gh pr list --state all`) |
| `M-03` | Automated Test Pass Rate (`v0.2.0`) | Combined automated test cases passing (`server` + `client` + `e2e` + `deploy/tests`) on `7c3a970` | Snapshot on release commit `7c3a970` (`2026-11-21 21:41 ICT`) | **179 / 179 passed (100.0%)**, `0` failed, `0` skipped (`128` server + `30` client + `4` E2E + `17` deploy) | `Deploy demo` run `44915248527` (job `136879353497`); CI run `44914888918` |
| `M-04` | UAT Defect Resolution Rate | Received CPMS UAT issues triaged, resolved (`Not-defect` test update or released code fix), retested `PASS`, and closed | `2026-11-18` – `2026-11-22 00:05 ICT` | **2 / 2 resolved (100.0%)**; accepted defects fixed **1 / 1 (100.0%)**; **0** open (`0` Critical, `0` Major, `0` Minor) | `docs/labs/lab-06/uat-findings.md` §1 (`#52`, `#54`); `#59` post-deploy comments |
| `M-05` | CI & Deploy Workflow Outcomes | Successful runs of `Deploy demo` and `CI & Docker Build` out of total runs per workflow | `2026-11-12` – `2026-11-22 00:05 ICT` | **`Deploy demo`:** **7 / 7 (100.0%)**<br>**`CI & Docker Build`:** **51 / 56 (91.1%)**, `5` failed (all non-gate human runs: **51 / 51 (100.0%)**) | §2.3 below (`gh run list --limit 100`, `69` total runs) |

## 2. Compact Source List (Self-Contained Reconciliation)

All values in `M-01`, `M-02`, and `M-05` reconcile directly from the tables below without opening external links.

### 2.1 Issues by Phase (`30` total: `29` closed, `1` open → `29 / 30 = 96.7%`)

| Phase / Milestone | Opened Issues | Closed | Open | Outcomes |
|---|---|---|---|---|
| Sprint 1 | `#1, #2, #3, #4, #5, #6, #13, #15` (`8`) | **8** | `0` | `#1` baseline, `#2`–`#5` F-01..F-04, `#6` E2E, `#13` CHG-01, `#15` release `v0.1.0` |
| Lab 5 | `#18, #19, #20, #21, #22` (`5`) | **5** | `0` | Docker, CI, GCP deploy, merge gate, persistence/rollback |
| Lab 6 | `#48, #49, #52, #54, #56` (`5`) | **5** | `0` | CI/UAT plan, `#52` Not-defect (retest PASS), `#54` Minor overflow fixed (`v0.1.2`), `#56` release |
| Lab 7 | `#59, #70` (`2`) | **1** | `1` (`#70`) | `#59` BR-05 7-day late window implemented (`v0.2.0`) & verified; `#70` records in progress |
| Sprint 2 | `#60, #62, #63, #64, #65, #66, #67, #68, #79` (`9`) | **9** | `0` | `#60` setup, `#62`–`#64`/`#66`–`#67` F-05..F-09, `#65` AC-01-10, `#79` & `#68` release `v0.2.0` |
| Sprint 3 | `#81` (`1`) | **1** | `0` | `#81` `sprint-3` branch + CI trigger setup (`PR #82` merged `4767ef5`) |
| **Total** | **`30`** | **`29`** | **`1`** | **`29 / 30 = 96.7%`** |

### 2.2 Pull Requests by Target Branch (`52` total: `39` human, `13` Dependabot → `38 / 39 = 97.4%` human merged)

| Target Branch | Merged PR Numbers | Merged | Closed Unmerged | Open | Notes |
|---|---|---|---|---|---|
| `sprint-1` | `#7, #8, #9, #10, #11, #12, #14, #16, #50, #51, #53, #55, #57` | **13** | `0` | `0` | Sprint 1 features/E2E (`8`) + Lab 6 docs/fixes (`5`) |
| `lab5-staging` | `#23, #24, #39, #41, #43, #45, #46` | **7** | `0` | `0` | Lab 5 packaging, CI, GCP, rollback/persistence |
| `sprint-2` | `#61, #69, #71, #72, #73, #74, #75, #76, #77, #78` | **10** | `0` | `0` | Sprint 2 setup, F-05..F-09, `#65`, Lab 7 `#59`, prep `#79` |
| `sprint-3` | `#82` | **1** | `0` | `0` | Sprint 3 branch & CI setup (`#81`, `4767ef5`) |
| `main` | `#17, #25, #42, #44, #47, #58, #80` | **7** | `14` (`#26`–`#38`, `#40`) | `0` | `#40` intentional merge-gate fail proof; `#26`–`#38` Dependabot closed after `#41` |
| **Total** | **`38` merged** | **`38`** | **`14` (`1` human + `13` bot)** | **`0`** | **Human merged: `38 / 39 = 97.4%`** |

### 2.3 Key CI & Deploy Workflow Runs (`69` total runs: `56` `CI & Docker Build`, `7` `Deploy demo`, `6` `Dependabot Updates`)

| Run ID | Workflow | Target / Branch | Date (UTC) | Conclusion | Purpose / Exception |
|---|---|---|---|---|---|
| `44927347197` | `CI & Docker Build` | `ci/sprint-3-setup` (`#82`) | `2026-11-21` | `success` | Sprint 3 setup (`3f67757`, `deploy/tests` 17 OK) |
| `44915248527` | `Deploy demo` | `main` (`#80`, `7c3a970`) | `2026-11-21` | `success` | **`v0.2.0`** live deploy (`cpms-00009-w5t`, `179/179` checks pass) |
| `44914888918` | `CI & Docker Build` | `sprint-2` (`#80`, `1f37fb2`) | `2026-11-21` | `success` | Release PR `#80` gate (`128` server, `30` client, `4` E2E, `17` deploy) |
| `44882523436` | `CI & Docker Build` | `feature/lab7-br05-late-window` (`#72`) | `2026-11-21` | `success` | Lab 7 `#59` RED → GREEN implementation (`785392c`) |
| `44880638379` | `CI & Docker Build` | `docs/lab7-br05-contract` (`#71`) | `2026-11-21` | `success` | Lab 7 `#59` contract revision before implementation (`5d55e4d`) |
| `44744094900` | `Deploy demo` | `main` (`#58`, `9dd9239`) | `2026-11-20` | `success` | `v0.1.2` (`cpms-00008-qwd`, `#54` fix) |
| `43726097082` | `Deploy demo` | `main` (`#47`, `38dc25c`) | `2026-11-15` | `success` | Lab 5 Release 3 (`cpms-00007-k5d`, Lab 6 UAT baseline) |
| `43462038722`, `43470205241`, `43476893936`, `43477461502` | `Deploy demo` | `main` (`1da4813`, `53003a5`) | `2026-11-13` | `success` (`4/4`) | Lab 5 releases & rollback/roll-forward verification |
| `43453823467` | `CI & Docker Build` | `test/prove-gate` (`#40`) | `2026-11-13` | `failure` | Intentional merge-gate proof (1 of 5 CI failures) |
| `43249258353`, `43249312327`, `43249332951`, `43249338577` | `CI & Docker Build` | `dependabot/*` (`#26, #35, #36, #37`) | `2026-11-12` | `failure` (`4/4`) | Unscoped npm major bumps before `#41` scoped Dependabot |

## 3. Interpretation (79 words)

Delivery reliability is high: 29/30 issues closed, 38/39 human PRs merged, all 7 deployments succeeded, and 179/179 automated checks passed on `v0.2.0` (`7c3a970`). The concrete risk observed in Lab 7 is environment drift: local Docker Desktop outages blocked DB/E2E runs on `#75`/`#77`, and testing `> 7 d` rejections live required TA-approved manual SQL setup (`Milestone.id = 22`) because `BR-04` blocks past deadlines. Action: `phet526` keeps Docker active locally and re-verifies `id = 22` on `v0.3.0` (`Sprint 3`, 29 Nov).
