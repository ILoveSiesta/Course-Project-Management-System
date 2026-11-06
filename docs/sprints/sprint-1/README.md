# Sprint 1 Engineering Contracts

One file per feature, written and committed **before** implementation (e.g. `F-01-<name>.md`).
Copy [`_contract-template.md`](_contract-template.md) to start a feature.

| Feature | Contract | Issue | Status |
|---|---|---|---|
| F-01 Authentication and team data | [`F-01-auth.md`](F-01-auth.md) | #2 | Implemented |
| F-02 Team view and milestone creation | [`F-02-milestone.md`](F-02-milestone.md) | #3 | Implemented |
| F-03 Submission and versions | [`F-03-submission.md`](F-03-submission.md) | #4 | Implemented |
| F-04 Feedback | [`F-04-feedback.md`](F-04-feedback.md) | #5 | Implemented |
| E2E Journeys & Release | [`E2E-journeys.md`](E2E-journeys.md) | #6 | Implemented |

## Product Definition of Done

Checked on `sprint-1` at `23026c6` (2026-11-06), before the release PR to `main`.

- [x] Required behavior implemented: F-01..F-04 and the E2E journeys (#2–#6)
- [ ] Planned verification executed; meaningful tests passing: all automated tests pass (below); the NFR-07 manual fresh-setup check by the teammate is still open
- [x] Teammate-reviewed PR merged into sprint staging: PRs #7–#12 and #14, each reviewed by the other student
- [x] Integration/acceptance checks run on staging: dev database reset with `npx prisma migrate reset --force`, then `npm run build` passed, `npm test` server 73/73 and client 15/15, `npm run test:e2e` 3/3; 0 failed, 0 skipped
- [x] Setup and documents current: README, contracts, traceability and contribution table (#15)
- [x] Incomplete work disclosed: see below

The same checks are run again on the release commit on `main` after the release PR is merged.

## Known limitations and incomplete work

| Item | Impact | Planned |
|---|---|---|
| NFR-07 reproducible setup: the manual fresh setup from the README by the teammate has not been recorded yet | Setup is used daily by both students, but not yet verified as a separate check | Before tag `v0.1.0` |
| Responsive layout at 375 px / 1280 px not verified (SR-06, NFR-11) | Screens are built for desktop width | Sprint 3 |
| No Docker image, CI pipeline, branch protection or GCP deployment | Tests run locally only; `main` has no required check yet | Lab 5 (15 Nov) |
| Teams and memberships come from the seed only; no team management UI (FR-07, D-06) | Changing teams needs a database change | Sprint 3 (F-13) |
| NFR-05 partly verified: 404, validation and auth error shapes are tested; 5xx cases are not | An unexpected server error is handled by the generic handler but has no feature test | Later sprints |
| E2E tests run against the dev database and leave timestamped test data there | Repeated runs add milestones and submissions to the dev data | Accepted for Sprint 1; revisit with CI in Lab 5 |
| E2E red commit `0a5b626` failed on test selectors, not on missing behavior (the journeys cover features already built) | E2E is system verification, not TDD evidence; TDD evidence is in F-01..F-04 | Disclosed in [`E2E-journeys.md`](E2E-journeys.md) §6 |
| Sprint 2–3 features (F-05..F-13) not implemented | Expected at Deliverable 1 | Sprints 2–3, see `docs/sprints/plan.md` |

Failed or skipped tests: none.
