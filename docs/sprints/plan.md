# Three-Sprint Plan

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |
| 0.2 | 2026-11-04 | ILoveSiesta | Sprint goals, feature allocation, dependencies and outcomes based on `docs/features.md` v0.2 |

Feature IDs refer to `docs/features.md`; requirement IDs to `docs/srs.md`.

## 1. Sprint overview

| Sprint | Dates | Goal | Feature IDs | Dependencies | Completion outcome | Checkpoint |
|---|---|---|---|---|---|---|
| 1 | 3 – 8 Nov 2026 | Small working domain slice: a supervisor sets a milestone, a student team submits work, the supervisor gives feedback — with real authentication, backend permissions and persistence | F-01, F-02, F-03, F-04; SR-01, SR-02, SR-04 | Engineering baseline (#1) first; then F-01 → F-02 → F-03 → F-04 → E2E (#6) | Release `v0.1.0` on `main`; all Sprint 1 AC verified by automated tests; documented local setup | Deliverable 1 — 8 Nov |
| 2 | 9 – 25 Nov 2026 | Core expansion: milestone maintenance, revision history, grades with release, team–milestone status; ship through the delivery pipeline | F-05, F-06, F-07, F-08, F-09; SR-03 | Sprint 1 release; Lab 5 pipeline (SR-03) before the Sprint 2 release | All Sprint 2 features complete, reviewed and verified; deployed on GCP from `main` | Deliverable 2 — 29 Nov (must be complete) |
| 3 | 26 Nov – 13 Dec 2026 | Completion and hardening: progress board, reports, filtering, team management; regression, UAT fixes, performance and responsive checks | F-10, F-11, F-12, F-13; SR-05, SR-06 | F-09 (status) for F-10–F-12; F-08 for F-11; D-06 answer from TA for F-13 | All baseline features complete; final regression and UAT re-tests pass; final release deployed | Progress at 29 Nov; final 13 Dec |

## 2. Sprint 1 scope

### 2.1 Why this slice

The theme's Sprint 1 example requires: seeded teams and membership, a supervisor creating a milestone for a
supervised team, a student submitting a title/description/link and viewing it, the supervisor recording feedback,
a deadline or revision rule, and a preserved submission–feedback association. Sprint 1 implements exactly that
journey, plus the rules that make it meaningful:

- **Deadline rule:** late submissions accepted and marked with days late (BR-05, D-01)
- **Revision rule:** versions 1..3, never overwritten, safe under concurrent submissions (BR-06, BR-07, NFR-06)
- **Association:** feedback bound to one version and kept across resubmissions (BR-09)
- **Access:** own team / assigned team scope and supervisor-only operations (BR-01–BR-03), login/logout with revocable tokens (FR-01–FR-04, NFR-04)

Teams, membership and supervisor assignments are seeded (D-06). Everything else is deferred to Sprints 2–3.

### 2.2 Order, owners and branches

Work alternates between the two students in issue order; the other student reviews each PR into `sprint-1`.

| Order | Issue | Branch | Owner | Reviewer | Needs |
|---|---|---|---|---|---|
| 1 | #1 DOCS baseline | `docs/sprint-1-baseline` | ILoveSiesta | phet526 | — |
| 2 | #2 F-01 Authentication and team data | `feature/F-01-auth` | phet526 | ILoveSiesta | #1 merged |
| 3 | #3 F-02 Team view and milestone creation | `feature/F-02-milestone` | ILoveSiesta | phet526 | #2 merged |
| 4 | #4 F-03 Submission and versions | `feature/F-03-submission` | phet526 | ILoveSiesta | #3 merged |
| 5 | #5 F-04 Feedback | `feature/F-04-feedback` | ILoveSiesta | phet526 | #4 merged |
| 6 | #6 E2E journeys + release checklist | `test/sprint-1-e2e` | phet526 | ILoveSiesta | #5 merged |
| — | Release PR `sprint-1` → `main`, tag `v0.1.0` | — | Both | The student who did not open it | #6 merged |

While one student implements, the other reviews the previous PR and writes the contract and failing tests for
their next issue, so each feature can start as soon as the previous one is merged.

### 2.3 Sprint 1 timeline

| Date | Planned work |
|---|---|
| 4 Nov | #1 baseline documents; PR review by phet526 |
| 5 Nov | #2 F-01 (contract → tests → implementation) |
| 6 Nov | #3 F-02, #4 F-03 |
| 7 Nov | #5 F-04, #6 E2E, integration checks on `sprint-1` |
| 8 Nov | Release PR, tag `v0.1.0`, Deliverable 1 PDF, submission on LEB2 |

## 3. Course labs within the sprints

| Lab | Due | Runs on | Sprint where it lands |
|---|---|---|---|
| Lab 5 — Docker, CI/CD, GCP | 15 Nov | Sprint 1 release `v0.1.0` | Sprint 2 (establishes SR-03) |
| Lab 6 — Cross-team UAT and defects | 22 Nov | A recorded release | Sprint 2 (defect fixes as `fix/` branches) |
| Lab 7 — Maintenance change and release readiness | 29 Nov | Current release | Sprint 2–3 boundary (approved change kept separate from feature work) |

## 4. Risks and responses

| Risk | Response |
|---|---|
| Sprint 1 has only 5 days; each feature waits for the previous merge | Write the next contract and failing tests during review; keep PRs small; review within a few hours |
| F-01 (auth + four models + seed) blocks every later feature | Start F-01 immediately after #1 is merged; agree the `User` model and role enum during #1 review |
| Decisions D-01..D-09 change after review | Settle them in the #1 PR review before any contract is written |
| D-06 answer from the TA removes or changes F-13 | Recorded as an approved change in `docs/traceability.md`; Sprint 3 scope adjusted |
| Final exams 1–11 Dec | Main Sprint 3 workflows done by 29 Nov; the final period is for fixes, verification and the video |
