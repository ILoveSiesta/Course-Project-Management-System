# Requirements Traceability Matrix

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |
| 0.2 | 2026-11-04 | ILoveSiesta | Every FR/BR/NFR in SRS v0.3 mapped to a feature or system responsibility and a sprint |
| 0.3 | 2026-11-04 | phet526 | Updated F-01 test executions and verification results (PASS on feature/F-01-auth) |
| 0.4 | 2026-11-04 | phet526 | Updated test references and exact commit SHA (d24f2c0) per PR #8 review |
| 0.5 | 2026-11-05 | ILoveSiesta | F-02 AC/tests and results (commit b97f30d) |
| 0.6 | 2026-11-05 | ILoveSiesta | Approved change CHG-01 (shared UI styling in Sprint 1) |
| 0.7 | 2026-11-06 | phet526 | F-03 AC/tests and verification results (commit 65aaf05) |
| 0.8 | 2026-11-06 | ILoveSiesta | F-04 AC/tests and results (commit 35b29a7) |
| 0.9 | 2026-11-06 | ILoveSiesta | Coverage gaps: FR-07 no longer depends on TA confirmation (D-06 Agreed) |
| 1.0 | 2026-11-06 | phet526 | Sprint 1 E2E journeys (#6) verification results (PASS on 049bbfe) |
| 1.1 | 2026-11-06 | ILoveSiesta | CHG-01: states that all UI from this change on uses the shared classes, with no inline styles; revision numbers 0.9–1.0 renumbered (0.8 was used twice) |
| 1.2 | 2026-11-06 | ILoveSiesta | E2E rows verified on `5936f32`, the reviewed head of PR #12 (#15) |
| 1.3 | 2026-11-06 | ILoveSiesta | NFR-07 manual fresh setup by phet526: PASS on `559bc29` (PR #16 review) |
| 1.4 | 2026-11-12 | ILoveSiesta | Approved change CHG-02 (Lab 5 deployment design) (#18) |
| 1.5 | 2026-11-21 | ILoveSiesta | F-05 AC/tests and results on the feature branch (commit `fdfdff4`, #62): FR-10, BR-13; F-05 rows added to BR-02, BR-03, BR-04 |
| 1.6 | 2026-11-21 | ILoveSiesta | Approved change CHG-03 (Lab 7 change request #59, BR-05 7-day late window): BR-05 and FR-12 rows list the revised and new AC/tests as PLANNED; earlier PASS kept for the v0.1 rule; coverage gap added |
| 1.7 | 2026-11-21 | ILoveSiesta | CHG-03 rows: RED `f5deaf7` → GREEN `8259688` on the feature branch (#59); revised BR-05 and FR-12 window rows PASS on `8259688` (accepted release recorded at the release) |
| 1.8 | 2026-11-21 | phet526 | Added `AC-01-10` / `TEST-01-14` seed idempotency row under BR-10 (`PASS` on commit `bbda76d`) and closed the Sprint 1 missing STS test ID in §4 (#65) |
| 1.9 | 2026-11-21 | ILoveSiesta | F-06 AC/tests and results on the feature branch (commit `997b7d1`, #63): FR-11; F-06 rows added to BR-02, BR-03, BR-04 (numbered 1.9 after #65 / PR #74 took 1.8) |
| 2.0 | 2026-11-21 | ILoveSiesta | F-08 AC/tests and results on the feature branch (commit `249bc1a`, #66): FR-18, FR-19, BR-11; F-08 rows added to BR-01, BR-02, BR-03 |
| 2.1 | 2026-11-21 | phet526 | F-07 AC/tests and results on the feature branch (commit `9751f0f`, #64): FR-15; F-07 rows added to BR-01, BR-02, BR-06, BR-09, NFR-02, NFR-03 (renumbered from 1.10 after F-08 PR #76 took 2.0) |
| 2.2 | 2026-11-21 | phet526 | F-09 AC/tests and results on the feature branch (commit `31949c8`, #67): FR-20, BR-12; F-09 access tests added to NFR-02, NFR-03 (renumbered after F-08 PR #76 took 2.0 and F-07 PR #75 took 2.1) |

Feature and responsibility IDs refer to `docs/features.md`.

**How this matrix is maintained.** Sprint 1 acceptance criteria (AC) and test IDs are created in each feature's
contract (`docs/sprints/sprint-1/F-0X-*.md`), committed before implementation. When a contract is merged, its AC
and test IDs are added to the "AC / verification" and "Planned test" columns below; "Actual test" and "Result"
are filled from executed test runs on the release commit. Sprint 2–3 rows get AC and tests in their sprint.

Result values: **PASS** · **FAIL** · **SKIPPED** · **INCOMPLETE** · **PLANNED**. A planned or unexecuted check is never marked PASS.

## 1. Functional requirements

| Requirement | Feature / responsibility | Sprint | AC / verification | Planned test | Actual test | Result | Version |
|---|---|---|---|---|---|---|---|
| FR-01 Login | F-01 | 1 | AC-01-01, AC-01-02, AC-01-03 | TEST-01-01..05 | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| FR-02 Current user | F-01 | 1 | AC-01-04, AC-01-05 | TEST-01-06..08b | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| FR-03 Logout revokes token | F-01 | 1 | AC-01-06 | TEST-01-09 | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| FR-04 Role-based home | F-01 | 1 | AC-01-11 | TEST-01-13..13c; E2E (#6) | `client/tests/Auth.test.tsx` | PASS | `d24f2c0` |
| FR-05 Student views own team | F-02 | 1 | AC-02-01, AC-02-11 | TEST-02-01, TEST-02-12 | `server/tests/api/teams-milestones.api.test.ts`; `client/tests/Milestones.test.tsx` | PASS | `b97f30d` |
| FR-06 Supervisor lists assigned teams | F-02 | 1 | AC-02-02 | TEST-02-02 | `server/tests/api/teams-milestones.api.test.ts` | PASS | `b97f30d` |
| FR-07 Team management | F-13 | 3 | Sprint 3 contract | — | — | PLANNED | — |
| FR-08 Create milestone | F-02 | 1 | AC-02-05, AC-02-12 | TEST-02-05, TEST-02-14; TEST-E2E-01 (#6) | `server/tests/api/teams-milestones.api.test.ts`; `client/tests/Milestones.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `5936f32` |
| FR-09 List milestones | F-02 | 1 | AC-02-09, AC-02-10, AC-02-11 | TEST-02-09, TEST-02-10, TEST-02-12, TEST-02-13 | `server/tests/api/teams-milestones.api.test.ts`; `client/tests/Milestones.test.tsx` | PASS | `b97f30d` |
| FR-10 Edit / extend milestone | F-05 | 2 | AC-05-01, AC-05-02, AC-05-08, AC-05-09 | TEST-05-01, TEST-05-02, TEST-05-09, TEST-05-10 | `server/tests/api/milestone-edit.api.test.ts`; `client/tests/MilestoneEdit.test.tsx` | PASS | `fdfdff4` |
| FR-11 Milestone for several teams | F-06 | 2 | AC-06-01, AC-06-02, AC-06-06, AC-06-07, AC-06-08 | TEST-06-01, TEST-06-02, TEST-06-07, TEST-06-08, TEST-06-09 | `server/tests/api/multi-team-milestone.api.test.ts`; `client/tests/MultiTeamMilestone.test.tsx` | PASS | `997b7d1` |
| FR-12 Submit work | F-03 | 1 | AC-03-01, AC-03-12 | TEST-03-01, TEST-03-15; TEST-E2E-01 (#6) | `server/tests/api/submissions.api.test.ts`; `client/tests/Submissions.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `5936f32` |
| FR-12 Submit work — 7-day late window (CHG-03) | F-03 (contract v0.2) | Lab 7 (Sprint 2) | AC-03-14, AC-03-15, AC-03-18 | TEST-03-19, TEST-03-20, TEST-03-23, TEST-03-24 | `server/tests/api/submissions.api.test.ts`; `client/tests/Submissions.test.tsx` | PASS | `8259688` |
| FR-13 View submissions, late flag | F-03 | 1 | AC-03-04..06, AC-03-12, AC-03-13 | TEST-03-04..07, TEST-03-15..17; TEST-E2E-01 (#6) | `server/tests/api/submissions.api.test.ts`; `server/tests/unit/submission-rules.test.ts`; `client/tests/Submissions.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `5936f32` |
| FR-14 Resubmit as new version | F-03 | 1 | AC-03-02, AC-03-03 | TEST-03-02, TEST-03-03, TEST-03-15 | `server/tests/api/submissions.api.test.ts`; `client/tests/Submissions.test.tsx` | PASS | `65aaf05` |
| FR-15 Revision history | F-07 | 2 | AC-07-01, AC-07-02, AC-07-03, AC-07-05, AC-07-06, AC-07-07 | TEST-07-01, TEST-07-02, TEST-07-03, TEST-07-05, TEST-07-06, TEST-07-07, TEST-07-08 | `server/tests/api/revision-history.api.test.ts`; `server/tests/unit/revision-history.test.ts`; `client/tests/RevisionHistory.test.tsx` | PASS | `9751f0f` |
| FR-16 Record feedback | F-04 | 1 | AC-04-01, AC-04-02, AC-04-06, AC-04-10 | TEST-04-01, TEST-04-02, TEST-04-06, TEST-04-11; TEST-E2E-01 (#6) | `server/tests/api/feedback.api.test.ts`; `client/tests/Feedback.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `5936f32` |
| FR-17 Students view feedback | F-04 | 1 | AC-04-07, AC-04-11 | TEST-04-07, TEST-04-13; TEST-E2E-01 (#6) | `server/tests/api/feedback.api.test.ts`; `client/tests/Feedback.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `5936f32` |
| FR-18 Record grade | F-08 | 2 | AC-08-01, AC-08-02, AC-08-07, AC-08-08 | TEST-08-01, TEST-08-02, TEST-08-07, TEST-08-08, TEST-08-09 | `server/tests/api/grades.api.test.ts`; `server/tests/unit/grade-validation.test.ts`; `client/tests/Grades.test.tsx` | PASS | `249bc1a` |
| FR-19 Release grades | F-08 | 2 | AC-08-03, AC-08-04, AC-08-05, AC-08-08, AC-08-09 | TEST-08-03, TEST-08-04, TEST-08-05, TEST-08-09, TEST-08-10, TEST-08-11 | `server/tests/api/grades.api.test.ts`; `client/tests/Grades.test.tsx` | PASS | `249bc1a` |
| FR-20 Team–milestone status | F-09 | 2 | AC-09-01, AC-09-02, AC-09-03, AC-09-04, AC-09-05, AC-09-07 | TEST-09-01, TEST-09-02, TEST-09-03, TEST-09-04, TEST-09-06, TEST-09-07, TEST-09-08 | `server/tests/api/milestone-status.api.test.ts`; `server/tests/unit/milestone-status.test.ts`; `client/tests/MilestoneStatus.test.tsx` | PASS | `31949c8` |
| FR-21 Progress board | F-10 | 3 | Sprint 3 contract | — | — | PLANNED | — |
| FR-22 Summary report | F-11 | 3 | Sprint 3 contract | — | — | PLANNED | — |
| FR-23 Filter submissions | F-12 | 3 | Sprint 3 contract | — | — | PLANNED | — |

## 2. Business rules

| Requirement | Feature / responsibility | Sprint | AC / verification | Planned test | Actual test | Result | Version |
|---|---|---|---|---|---|---|---|
| BR-01 Student scope: own team | SR-01; F-02, F-03, F-04, F-07, F-08 | 1 (re-verified each sprint) | AC-02-03, AC-02-09, AC-02-10; AC-03-07, AC-03-08; AC-04-07; AC-07-04; AC-08-05, AC-08-06 | TEST-02-03, TEST-02-09, TEST-02-10; TEST-03-08, TEST-03-09; TEST-04-07; TEST-07-04; TEST-08-05, TEST-08-06 | `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts`; `server/tests/api/revision-history.api.test.ts`; `server/tests/api/grades.api.test.ts` | PASS (F-02..F-04, F-07, F-08 endpoints) | `249bc1a; 9751f0f` |
| BR-02 Supervisor scope: assigned teams | SR-01; F-02, F-03, F-04, F-05, F-06, F-07, F-08 | 1 (re-verified each sprint) | AC-02-02, AC-02-03, AC-02-06, AC-02-10; AC-03-06, AC-03-07; AC-04-04, AC-04-07; AC-05-04; AC-06-03; AC-07-04; AC-08-06 | TEST-02-02, TEST-02-03, TEST-02-06, TEST-02-10; TEST-03-07, TEST-03-08; TEST-04-04, TEST-04-07; TEST-05-04; TEST-06-03; TEST-07-04; TEST-08-06 | `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts`; `server/tests/api/milestone-edit.api.test.ts`; `server/tests/api/multi-team-milestone.api.test.ts`; `server/tests/api/revision-history.api.test.ts`; `server/tests/api/grades.api.test.ts` | PASS (F-02..F-08 endpoints) | `249bc1a; 9751f0f` |
| BR-03 Supervisor-only operations | SR-01; F-02, F-04 (Sprint 1); F-05, F-06, F-08, F-13 (later) | 1 | AC-01-07, AC-02-07, AC-03-08, AC-04-03; AC-05-04; AC-06-04; AC-08-06 | TEST-01-10, TEST-02-07, TEST-03-10, TEST-04-03; TEST-05-04; TEST-06-04; TEST-08-06 | `server/tests/api/auth.api.test.ts`; `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts`; `server/tests/api/milestone-edit.api.test.ts`; `server/tests/api/multi-team-milestone.api.test.ts`; `server/tests/api/grades.api.test.ts` | PASS (F-01 guard, F-02 create, F-03 student-only, F-04 feedback, F-05 edit, F-06 multi-team create, F-08 grade/release) | `249bc1a` |
| BR-04 Milestone validation, future deadline | F-02, F-05, F-06 | 1 | AC-02-08; AC-05-05; AC-06-05 | TEST-02-08, TEST-02-11, TEST-02-15; TEST-05-05, TEST-05-08; TEST-06-05, TEST-06-06 | `server/tests/api/teams-milestones.api.test.ts`; `server/tests/unit/milestone-validation.test.ts`; `client/tests/Milestones.test.tsx`; `server/tests/api/milestone-edit.api.test.ts`; `server/tests/unit/milestone-update-validation.test.ts`; `server/tests/api/multi-team-milestone.api.test.ts`; `server/tests/unit/team-ids-validation.test.ts` | PASS | `997b7d1` |
| BR-05 Late flag and days late (v0.1 rule) | F-03 | 1 | AC-03-04 (v0.1) | TEST-03-04, TEST-03-05 | `server/tests/api/submissions.api.test.ts`; `server/tests/unit/submission-rules.test.ts` | PASS (v0.1 rule, superseded by CHG-03) | `65aaf05` |
| BR-05 rev. — late window of 7 × 24 h (CHG-03) | F-03 (contract v0.2); interaction with F-05 | Lab 7 (Sprint 2) | AC-03-04 (rev.), AC-03-14, AC-03-15, AC-03-16, AC-03-17, AC-03-18 | TEST-03-04, TEST-03-05, TEST-03-18..TEST-03-24; regression TEST-03-25 | `server/tests/unit/submission-rules.test.ts`; `server/tests/api/submissions.api.test.ts`; `client/tests/Submissions.test.tsx`; `e2e/*.spec.ts` | PASS | `8259688` |
| BR-06 Sequential, unique versions | F-03 (F-07 displays history) | 1 | AC-03-01, AC-03-02, AC-03-11; AC-07-02 | TEST-03-01, TEST-03-02, TEST-03-14; TEST-07-02 | `server/tests/api/submissions.api.test.ts`; `server/tests/api/revision-history.api.test.ts` | PASS | `9751f0f` |
| BR-07 Max 3 versions | F-03 | 1 | AC-03-03 | TEST-03-03, TEST-03-16; TEST-E2E-02 (#6) | `server/tests/api/submissions.api.test.ts`; `client/tests/Submissions.test.tsx`; `e2e/sprint1-rejection-journey.spec.ts` | PASS | `5936f32` |
| BR-08 Submission validation | F-03 | 1 | AC-03-09 | TEST-03-11, TEST-03-12 | `server/tests/api/submissions.api.test.ts`; `server/tests/unit/submission-rules.test.ts` | PASS | `65aaf05` |
| BR-09 Feedback per version, append-only | F-04 (F-07 displays history) | 1 | AC-04-05, AC-04-06, AC-04-09; AC-07-02 | TEST-04-05, TEST-04-06, TEST-04-09, TEST-04-10; TEST-07-02 | `server/tests/api/feedback.api.test.ts`; `server/tests/unit/feedback-validation.test.ts`; `server/tests/api/revision-history.api.test.ts` | PASS | `9751f0f` |
| BR-10 One team per student | F-01 (seed + DB constraint); F-13 (UI) | 1, 3 | AC-01-09 | TEST-01-12 | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| BR-10 (seed, AC-01-10) Idempotent demo seed | F-01 | 1 (verified Sprint 2, #65) | AC-01-10 | TEST-01-14 | `server/tests/api/auth.api.test.ts` | PASS | `bbda76d` |
| BR-11 Grade visibility after release; scale and change rules | F-08 | 2 | AC-08-02, AC-08-03, AC-08-04, AC-08-05, AC-08-07 | TEST-08-02, TEST-08-03, TEST-08-04, TEST-08-05, TEST-08-07, TEST-08-08 | `server/tests/api/grades.api.test.ts`; `server/tests/unit/grade-validation.test.ts` | PASS | `249bc1a` |
| BR-12 Derived status | F-09 | 2 | AC-09-01, AC-09-02, AC-09-03, AC-09-04 | TEST-09-01, TEST-09-02, TEST-09-03, TEST-09-06 | `server/tests/api/milestone-status.api.test.ts`; `server/tests/unit/milestone-status.test.ts` | PASS | `31949c8` |
| BR-13 Deadline only extended | F-05 | 2 | AC-05-02, AC-05-03, AC-05-06, AC-05-07 | TEST-05-02, TEST-05-03, TEST-05-06, TEST-05-07 | `server/tests/api/milestone-edit.api.test.ts` | PASS | `fdfdff4` |
| BR-14 Membership change keeps submitter | F-13 | 3 | Sprint 3 contract | — | — | PLANNED | — |

## 3. Non-functional requirements

| Requirement | Feature / responsibility | Sprint | Target / verification | Planned test | Actual test | Result | Version |
|---|---|---|---|---|---|---|---|
| NFR-01 Hashed passwords | F-01 | 1 | 100% bcrypt hashes, cost ≥ 10 | TEST-01-11 | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| NFR-02 401 on protected endpoints | SR-01 | 1 (extended each sprint) | Every protected endpoint, 4 token cases | TEST-01-07..08b, TEST-02-04, TEST-03-13, TEST-04-08, TEST-07-04, TEST-09-05 | `server/tests/api/auth.api.test.ts`; `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts`; `server/tests/api/revision-history.api.test.ts`; `server/tests/api/milestone-status.api.test.ts` | PASS (F-01..F-04, F-07, F-09 endpoints) | `9751f0f; 31949c8` |
| NFR-03 Backend authorization | SR-01 | 1 (extended each sprint) | 403/404, no data | TEST-01-10, TEST-02-03, 06, 07, 10; TEST-03-08..10; TEST-04-03, TEST-04-04; TEST-07-04, TEST-09-05 | `server/tests/api/auth.api.test.ts`; `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts`; `server/tests/api/revision-history.api.test.ts`; `server/tests/api/milestone-status.api.test.ts` | PASS (F-01..F-04, F-07, F-09) | `9751f0f; 31949c8` |
| NFR-04 Token expiry and logout | F-01 | 1 | ≤ 2 h; revoked after logout | TEST-01-09, TEST-01-08b | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| NFR-05 Safe error shape | SR-02 | 1 | JSON shape, no internals | Skeleton test `server/tests/health.api.test.ts` (404 case); F-01–F-04 STS | `health.api.test.ts` › unknown API route | PASS (404 case only) | `49d3c70` |
| NFR-06 Concurrent submissions | F-03 | 1 | 10 parallel → unique versions, limit kept | TEST-03-14 | `server/tests/api/submissions.api.test.ts` | PASS | `65aaf05` |
| NFR-07 Reproducible setup | SR-04 | 1 | README-only fresh setup | Teammate run before release (manual check, #6) | Manual: phet526 followed the README on their own machine (install, env setup, `npm run build`, `npm test`, `npm run test:e2e`), recorded in the PR #16 review | PASS (manual) | `559bc29` |
| NFR-08 Durable data on GCP | SR-03 | 2 | Data survives restart/redeploy | Post-deployment check (Lab 5) | — | PLANNED | — |
| NFR-09 CI quality gate | SR-03 | 2 | Failing check blocks merge | CI run evidence (Lab 5) | — | PLANNED | — |
| NFR-10 Response time | SR-05 (with F-11) | 3 | p95 ≤ 500 ms on seeded dataset | Sprint 3 smoke test | — | PLANNED | — |
| NFR-11 Responsive UI | SR-06 | 3 | 375 px and 1280 px | Sprint 3 Playwright viewports | — | PLANNED | — |
| NFR-12 Understandable rejections | SR-02 | 1 (extended each sprint) | Reason shown for every rejection | TEST-02-15 (milestone validation); TEST-03-16 (version limit); TEST-04-12 (feedback validation); TEST-E2E-02 (#6) | `client/tests/Milestones.test.tsx`; `client/tests/Submissions.test.tsx`; `client/tests/Feedback.test.tsx`; `e2e/sprint1-rejection-journey.spec.ts` | PASS | `5936f32` |

## 4. Coverage gaps

- No requirement is unallocated: all 23 FR, 14 BR and 12 NFR map to a feature or system responsibility and a sprint.
- F-01 AC and tests are implemented and passing on commit `d24f2c0`; follow-up `AC-01-10` (`TEST-01-14`, #65) passed on commit `bbda76d` (server 102 passed, client 21 passed, E2E 4 passed, `deploy/tests` 17 OK), removing the Sprint 1 missing-test limitation.
- F-02 AC and tests are implemented and passing on commit `b97f30d` (server tests on the separate `cpms_test` database).
- F-03 AC and tests are implemented and passing on commit `65aaf05`.
- F-04 AC and tests are implemented and passing on commit `35b29a7`.
- F-05 AC and tests are implemented and passing on commit `fdfdff4` (feature branch; accepted release recorded at the Sprint 2 release).
- F-06 AC and tests are implemented and passing on commit `997b7d1` (feature branch; accepted release recorded at the Sprint 2 release).
- F-07 AC and tests are implemented and passing on commit `9751f0f` (feature branch; accepted release recorded at the Sprint 2 release).
- F-08 AC and tests are implemented and passing on commit `249bc1a` (feature branch; accepted release recorded at the Sprint 2 release).
- F-09 AC and tests are implemented and passing on commit `31949c8` (feature branch; accepted release recorded at the Sprint 2 release).
- E2E #6 verified Sprint 1 normal domain journey (TEST-E2E-01) and rejection journey (TEST-E2E-02) on commit `5936f32` (the reviewed head of PR #12; specs first passed on `049bbfe`).
- Sprint 2–3 requirements have a feature and sprint but no AC or tests yet; this is expected at Deliverable 1.
- BR-05 was revised by CHG-03 (Lab 7, #59). The v0.1 rule's PASS results stay recorded; the revised rule (AC-03-04 rev., AC-03-14..AC-03-18) failed on the pre-change code at RED `f5deaf7` and passes on GREEN `8259688` (feature branch; accepted release and deployed revision recorded at the release). Impact analysis: `docs/labs/lab-07/change-impact.md`.
- NFR-05 is partly verified (404 and F-01 validation/auth error shapes). 5xx cases come with later features.
- F-13 / FR-07 (team management) is planned for Sprint 3 as decided in D-06.

## 5. Approved changes

| Change ID | Date | Affected requirement/feature | Change | Rationale | Approved by |
|---|---|---|---|---|---|
| CHG-01 | 2026-11-05 | SDS §3.2; UI of F-01 and F-02 (login, header, student and supervisor pages); SR-06 / NFR-11 (partly earlier) | Add a shared stylesheet (`client/src/theme.css`) and replace inline styles in Sprint 1, inside #3 F-02 (PR #9). From this change on, all UI uses the classes in `client/src/theme.css`; no inline styles. Responsive verification at 375 px / 1280 px stays in Sprint 3. No requirement, AC or test changes; all UI texts, labels and roles are unchanged. | When the team looked at the first working F-02 screens, they were too plain to use as Deliverable 1 evidence and for the cross-team UAT in Lab 6. Doing it now, before F-03 and F-04, means those features reuse the same classes instead of every screen being restyled at the end of Sprint 3. It was done in #3 rather than a new issue because F-02 created most of the screens and the change is small and UI-only. | ILoveSiesta (proposed); phet526 confirmed in the PR #9 review |
| CHG-03 | 2026-11-21 | BR-05, D-01, FR-12 (BR-13 note); F-03 contract v0.2 (AC-03-04 revised, AC-03-14..AC-03-18, TEST-03-18..TEST-03-25); SDS §1.3, §4 | Late submissions are accepted for at most 7 × 24 h after the milestone deadline (inclusive); later ones get `409 SUBMISSION_WINDOW_CLOSED` and nothing is stored. Version limit is still checked first. The window follows the deadline in force at submission time, so a BR-13 extension moves it; there is no other override. Existing versions are kept unchanged; no schema change or migration. Lab 7 change request #59. | Supervisors need a fixed point after which a milestone's submissions are final so they can review and grade (F-08); with no limit, a grade can be invalidated by a version submitted weeks later. This is a requirement change to Sprint 1 behaviour that was correct (Lab 7), not a defect. | TA Kantapat Suwannahong, 2026-11-21 13:20 ICT (Facebook Messenger, recorded in #59 §10); §5/§6 clarification acknowledged by the TA the same day; contract reviewed by phet526 in this PR |
| CHG-02 | 2026-11-12 | SDS §7–§8; SR-03 / NFR-08, NFR-09 (deployment design only) | Lab 5 deployment follows the course starter kit: (1) migrations and the seed run in a separate Cloud Run job before the service is updated, instead of the container running `prisma migrate deploy` at start-up; (2) a merge into `main` deploys without an extra manual approval step — the gate is the reviewed PR plus the required CI check; (3) new `GET /api/ready`; (4) the seed requires `SEED_DEMO_PASSWORD` and has no password in code. No FR/BR/AC changes; NFR-08/09 targets unchanged. | (1) With Cloud Run several instances may start at once, and a failed migration would leave the service crash-looping; a separate job stops the release before users are affected. (2) The spec allows either; every change reaching `main` is already reviewed and tested, and the kit's rollback (re-run with an earlier SHA) covers a bad release. (3) The post-deploy smoke test must show the database is reachable. (4) Lab 5 handout/Student Guide Episode 2: demo passwords never come from code. | ILoveSiesta (proposed in #18); phet526 confirms in the #18 PR review |
