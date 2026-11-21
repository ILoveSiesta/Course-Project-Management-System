# Lab 7: Release Readiness, Technical Debt, and Retrospective (`#70`)

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-22 | phet526 | Release readiness verdict (`READY`) for maintained Sprint 1 scope + CHG-03 (`BR-05 rev.`) on `v0.2.0` (`7c3a970`, `cpms-00009-w5t`), technical debt register, and retrospective (`#70`) |
| 0.2 | 2026-11-22 | phet526 | Address PR `#86` review: explicitly label manual vs automated tests in §2/§3/§4.2/§5 and separate `[TEST]` DB precondition data from the §6 Technical Debt register (`#70`) |

## 1. Readiness Verdict (Maintained Sprint 1 Scope)

> **Verdict: `READY`** for the **maintained Sprint 1 scope** (accepted Sprint 1 `F-01`–`F-04` behaviour + approved Lab 7 change `BR-05 rev. / CHG-03` from `#59`) on the live `v0.2.0` release (`7c3a970`, Cloud Run revision `cpms-00009-w5t`).
>
> *Scope note:* Sprint 2 features (`F-05`–`F-09`) shipped alongside `#59` in `v0.2.0`, but per Lab 7 `#70` they are **not counted** as Sprint 1 maintenance evidence below. `#70` records travel through `sprint-3` into `main` with `v0.3.0` (`29 Nov`, `#81`); when `v0.3.0` deploys, `phet526` will repeat a quick `409` check on existing `Milestone.id = 22` (`[TEST]`) so the `v0.3.0` PDF submission matches the live revision.

## 2. Submitted / Deployed Version

| Field | Value | Source |
|---|---|---|
| Release tag / PR | `v0.2.0` / PR `#80` (`sprint-2` `1f37fb2` → `main`), merged `2026-11-21 14:41:35Z` (`21:41:35 ICT`) | PR `#80`, Issue `#68` |
| Release commit (full SHA) | `7c3a970690a241973becdc934e448eecd41dc51f` (`7c3a970`) | `main` |
| `Deploy demo` run | `44915248527` (`test / test-and-docker` + `deploy` **success**) | GitHub Actions |
| Image digest | `asia-southeast1-docker.pkg.dev/cpe334-cpms/cpms/cpms@sha256:2726c70a7ae1aa452ce31a74056febd8b717e4f70ca8a3d00e547283025a05cf` | `44915248527` deploy log |
| Migration job execution | `cpms-migrate-wxp8q` (completed; applies `20261121092553_f08_grades`, `seed` re-run idempotent) | `#68` comment `7064438219` |
| Cloud Run revision & URL | `cpms-00009-w5t` (`100%` traffic; previous `v0.1.2` = `cpms-00008-qwd`) · https://cpms-6pjdhtz32a-as.a.run.app | `44915248527` & `#68` |
| UI version label | Footer shows `CPMS v0.2.0` (`API: ok`) | **Manual** live URL inspection & **Automated** `App.test.tsx` |

## 3. Defects and UAT Status (Maintained Sprint 1 Scope)

| Severity | Open | Closed / Resolved | Details |
|---|---|---|---|
| **Critical** | **0** | **0** | None reported in Lab 6 UAT (`#52`, `#54`), Lab 7 (`#59`), or post-deploy checks. |
| **Major** | **0** | **0** | None reported. |
| **Minor** | **0** | **1** | `#54` (long unbroken milestone title/description horizontal overflow on `38dc25c`): fixed in PR `#55` (`d4590dc`), released in `v0.1.2` (`9dd9239`), independent **manual** retest `PASS` (`ArgoJR203`), and **automated** regression guard in `e2e/issue54-text-wrapping.spec.ts` (`PASS` on `7c3a970`). |
| **Not-defect** | **0** | **1** | `#52` (UAT-06 reused UAT-01 milestone hitting BR-07 3-version limit): test pack corrected in `uat-plan.md` v0.3 (PR `#53`), independent **manual** retest `PASS` (`Gluesaber`). |

## 4. Verification Summary on Maintained Sprint 1 + `BR-05 rev.` Scope

### 4.1 Automated Checks on `7c3a970` (Automated Tests — `Deploy demo` run `44915248527`)

No tests failed or were skipped (`179 / 179` passed across the entire repository):

| Check | Scope / Command | Passed | Failed | Skipped | Maintained Sprint 1 / Lab 7 Coverage |
|---|---|---|---|---|---|
| Server integration & unit (`vitest`) | `npm test --prefix server` (`20` files) | **128** | **0** | **0** | `auth.api.test.ts` (incl. `TEST-01-14`), `teams-milestones.api.test.ts`, `submissions.api.test.ts` (incl. `TEST-03-19..22`), `feedback.api.test.ts`, `cloud-ready.api.test.ts`, `health.api.test.ts`, `unit/submission-rules.test.ts` (incl. `TEST-03-18`), `unit/milestone-validation.test.ts`, `unit/feedback-validation.test.ts`, `unit/seed-password.test.ts` *(plus Sprint 2 F-05..F-09 files)* |
| Client component tests (`vitest`) | `npm test --prefix client` (`10` files) | **30** | **0** | **0** | `App.test.tsx` (`CPMS v0.2.0`), `Auth.test.tsx`, `Milestones.test.tsx`, `Submissions.test.tsx` (incl. `TEST-03-23..24`), `Feedback.test.tsx` *(plus Sprint 2 F-05..F-09 UI files)* |
| Playwright E2E (`chromium`) | `npm run test:e2e` (`4` specs) | **4** | **0** | **0** | `smoke.spec.ts`, `sprint1-normal-journey.spec.ts` (`TEST-E2E-01`), `sprint1-rejection-journey.spec.ts` (`TEST-E2E-02`), `issue54-text-wrapping.spec.ts` |
| Deploy & workflow unit tests | `python3 -m unittest discover -s deploy/tests` | **17** | **0** | **0** | `test_smoke.py`, `test_workflows.py` |

Note: TDD RED (`f5deaf7`: server `3 failed`, client `1 failed`) → GREEN (`8259688`: server `101 passed`, client `21 passed`, E2E `4 passed`, deploy `17 OK`) was verified on PR `#72` before merge (`feaafdb`). Local checks on `1f37fb2` before `#80` merge passed all `30` client tests, `41` non-DB server unit/health checks, `npm run build`, and `17` deploy tests (local Docker Desktop was stopped during the final review; full DB/E2E ran in `44914888918` and `44915248527`).

### 4.2 Post-Deployment Checks on Live URL (Manual Tests — `cpms-00009-w5t`, `#59` Comments)

Verified on `https://cpms-6pjdhtz32a-as.a.run.app` (`2026-11-21` ICT, `CPMS v0.2.0`):

| Check | Test Type | Source Comment in `#59` | Account / Target | Observed Result |
|---|---|---|---|---|
| **Baseline health, readiness, unauthenticated guards** | **Automated** (`deploy/smoke_test.py`) + **Manual** (browser URL/footer inspection) | `#68` (`7064438219`), `44915248527` smoke test | Unauthenticated | `/api/health` → `200`, `/api/ready` → `200`, `/api/teams` & protected Sprint 1/2 routes → `401 UNAUTHENTICATED`, bundle serves `CPMS v0.2.0` |
| **`BR-05 rev.` within 7-day late window (`<= 7 d`)** | **Manual** (browser test) | `#59` (`7065262659`, screenshots `01`–`02`) | `student1@cpms.test` on `T121` (`/student/milestones/11`, due `19 Nov 22:09 ICT`) | Accepted `Version 1: Lab7 within-7d late check` (`Late (+3 d)`); badge updated to `Submitted late` |
| **Preserved Sprint 1 domain flow (`F-02` → `F-03` → `F-04`)** | **Manual** (browser test) | `#59` (`7065262659`, screenshots `05`–`08`) | `supervisor1` & `student1` on `Lab7 Post-deploy Check` (`/milestones/21`) | Supervisor created milestone (`Not submitted`), student submitted `v1` (`On time`), supervisor recorded feedback and student read it |
| **Preserved Sprint 1 cross-team access (`BR-01` / `NFR-03`)** | **Manual** (browser test) | `#59` (`7065262659`, screenshot `09`) | `student3@cpms.test` (Team Beta) opens `/student/milestones/21` | Rejected with `"Milestone not found or not allowed"` (`404`), no Team Alpha data exposed |
| **Pre-deployment data preserved (`v0.1.2` → `v0.2.0`)** | **Manual** (browser test) | `#59` (`7065262659`, screenshot `10`) | `student1@cpms.test` opens `UAT-01` (`/student/milestones/8`, `18 Nov`) | Existing `v1`–`v3` submissions and supervisor feedback remain readable |
| **`BR-05 rev.` closed window (`> 7 d`, UI notice & `409`)** | **Manual** (UI + DevTools Console `fetch` test) | `#59` (`7065624902` screenshots `11`–`14`, `7065804018` screenshots `15`–`16`) | `student1@cpms.test` on `[TEST] Lab7 Closed Window Check (>7d)` (`Milestone.id = 22`, due `13 Nov 23:19 ICT`, manual setup approved by TA Kantapat Suwannahong at `23:09 ICT` and executed by `phet526` at `23:19 ICT`) | UI form replaced by `"Late submissions are accepted up to 7 days after the deadline."`; `POST /api/milestones/22/submissions` returned HTTP `409` (`"code": "SUBMISSION_WINDOW_CLOSED"`); page reload confirmed `Submissions: No submissions yet.` |

## 5. Configuration, Documentation, and Deployment Checklist

- **Configuration & secrets:** No new environment variables or secrets added for `#59` (the 7-day constant is code-enforced). Cloud Run uses Secret Manager `cpms-database-url`, `cpms-jwt-secret`, and `cpms-demo-password` (for `cpms-migrate` seed only); no real secrets exist in git (`server/.env.example`, `client/.env.example` hold placeholders).
- **Documentation & run instructions:** `docs/srs.md` (v0.9, `BR-05 rev.`), `docs/system-sds.md` (v0.11, `409 SUBMISSION_WINDOW_CLOSED`), `docs/traceability.md` (v2.2, `CHG-03`), `docs/features.md` (v1.6), `docs/sprints/sprint-1/F-03-submission.md` (v0.2), `docs/labs/lab-07/change-impact.md` (v0.1), `docs/sprints/plan.md` (v0.7), `README.md`, and `docs/labs/lab-05/deployment.md` are current.
- **Deployment / smoke status:** `Deploy demo` (`44915248527`) green on `7c3a970`; `cpms-00009-w5t` serving `100%` traffic; **automated** post-deploy smoke checks (`/api/health`, `/api/ready`, `/`, `/api/teams` `401`) and **manual** browser checks (`CPMS v0.2.0` footer & `#59` scenarios) pass.

## 6. Technical Debt Register

| ID | Item | Impact | Priority | Disposition / Owner & Target |
|---|---|---|---|---|
| `TD-01` | E2E Playwright specs cover Sprint 1 journeys and `#54` wrapping only; Sprint 2 screens (`F-05`–`F-09`) rely on Vitest unit/API/UI tests rather than live browser E2E | Regressions appearing only in multi-step Sprint 2 browser flows would not be caught automatically in `test:e2e` | Medium | **Accepted for Sprint 2 / Lab 7** (`sprint-2/README.md` §5); add Sprint 2+3 E2E journey before `v1.0.0` (`ILoveSiesta` / Sprint 3, 13 Dec) |
| `TD-02` | `NFR-05` 5xx forced-error shape test and `NFR-10` performance benchmark (`p95 <= 500 ms` on 20 teams × 10 milestones) are not yet automated (`traceability.md` §3–§4) | Latency and unexpected-500 JSON formatting are verified by code inspection rather than automated regression | Low | **Planned for Sprint 3** (`F-11` / `NFR-10` smoke test + error-shape unit check before `v1.0.0`, 13 Dec) |
| `TD-03` | `NFR-11` responsive layout (`375 px` / `1280 px`) was manually checked on `F-07` and `F-09` only, not yet automated across all screens | Layout overflows on other Sprint 2 screens could slip until viewport Playwright checks run | Medium | **Planned for Sprint 3** (`SR-06` Playwright viewport suite before `v1.0.0`, 13 Dec) |

> **Demo-instance test precondition data (not technical debt):** Production Cloud SQL retains `[TEST] Lab7 Closed Window Check (>7d)` (`Milestone.id = 22`) and `Lab7 Post-deploy Check` (`Milestone.id = 21`) in Team Alpha's list on `cpms-6pjdhtz32a-as.a.run.app` because `v0.2.0` omits milestone deletion by design. Per TA instructions, `Milestone.id = 22` will be kept and reused for the repeat `409` verification on `v0.3.0` (`phet526`, 29 Nov).

## 7. Retrospective (Lab 7)

1. **What helped:** Writing the contract revision (`PR #71`) and impact analysis (`change-impact.md`) before touching code made boundary rules (`deadline + 7 × 24 h`, `409` check order after `VERSION_LIMIT_REACHED`, and `BR-13` interaction) unambiguous across implementation and review (`PR #72`).
2. **What hurt:** Parallel Sprint 2 PRs (`#75`, `#76`, `#77`) created recurring revision-number conflicts in shared docs and uncovered a subtle layout squeeze in `SupervisorMilestone.tsx`, while stopping local Docker Desktop forced late verification onto CI runs.
3. **What will change for the final release (`v1.0.0`):** Keep local Docker running during every PR review/fix cycle, add browser-width/Playwright E2E assertions for new screens before opening PRs, and repeat a `Milestone.id = 22` live check on `v0.3.0` (`29 Nov`) once `#70` reaches `main`.
