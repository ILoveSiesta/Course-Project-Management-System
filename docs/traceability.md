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
| 0.8 | 2026-11-06 | ILoveSiesta | Coverage gaps: FR-07 no longer depends on TA confirmation (D-06 Agreed) |
| 0.9 | 2026-11-06 | phet526 | Sprint 1 E2E journeys (#6) verification results (PASS on 049bbfe) |

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
| FR-08 Create milestone | F-02 | 1 | AC-02-05, AC-02-12 | TEST-02-05, TEST-02-14; TEST-E2E-01 (#6) | `server/tests/api/teams-milestones.api.test.ts`; `client/tests/Milestones.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `049bbfe` |
| FR-09 List milestones | F-02 | 1 | AC-02-09, AC-02-10, AC-02-11 | TEST-02-09, TEST-02-10, TEST-02-12, TEST-02-13 | `server/tests/api/teams-milestones.api.test.ts`; `client/tests/Milestones.test.tsx` | PASS | `b97f30d` |
| FR-10 Edit / extend milestone | F-05 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-11 Milestone for several teams | F-06 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-12 Submit work | F-03 | 1 | AC-03-01, AC-03-12 | TEST-03-01, TEST-03-15; TEST-E2E-01 (#6) | `server/tests/api/submissions.api.test.ts`; `client/tests/Submissions.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `049bbfe` |
| FR-13 View submissions, late flag | F-03 | 1 | AC-03-04..06, AC-03-12, AC-03-13 | TEST-03-04..07, TEST-03-15..17; TEST-E2E-01 (#6) | `server/tests/api/submissions.api.test.ts`; `server/tests/unit/submission-rules.test.ts`; `client/tests/Submissions.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `049bbfe` |
| FR-14 Resubmit as new version | F-03 | 1 | AC-03-02, AC-03-03 | TEST-03-02, TEST-03-03, TEST-03-15 | `server/tests/api/submissions.api.test.ts`; `client/tests/Submissions.test.tsx` | PASS | `65aaf05` |
| FR-15 Revision history | F-07 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-16 Record feedback | F-04 | 1 | AC-04-01, AC-04-02, AC-04-06, AC-04-10 | TEST-04-01, TEST-04-02, TEST-04-06, TEST-04-11; TEST-E2E-01 (#6) | `server/tests/api/feedback.api.test.ts`; `client/tests/Feedback.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `049bbfe` |
| FR-17 Students view feedback | F-04 | 1 | AC-04-07, AC-04-11 | TEST-04-07, TEST-04-13; TEST-E2E-01 (#6) | `server/tests/api/feedback.api.test.ts`; `client/tests/Feedback.test.tsx`; `e2e/sprint1-normal-journey.spec.ts` | PASS | `049bbfe` |
| FR-18 Record grade | F-08 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-19 Release grades | F-08 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-20 Team–milestone status | F-09 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-21 Progress board | F-10 | 3 | Sprint 3 contract | — | — | PLANNED | — |
| FR-22 Summary report | F-11 | 3 | Sprint 3 contract | — | — | PLANNED | — |
| FR-23 Filter submissions | F-12 | 3 | Sprint 3 contract | — | — | PLANNED | — |

## 2. Business rules

| Requirement | Feature / responsibility | Sprint | AC / verification | Planned test | Actual test | Result | Version |
|---|---|---|---|---|---|---|---|
| BR-01 Student scope: own team | SR-01; F-02, F-03, F-04 | 1 (re-verified each sprint) | AC-02-03, AC-02-09, AC-02-10; AC-03-07, AC-03-08; AC-04-07 | TEST-02-03, TEST-02-09, TEST-02-10; TEST-03-08, TEST-03-09; TEST-04-07 | `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts` | PASS (F-02..F-04 endpoints) | `35b29a7` |
| BR-02 Supervisor scope: assigned teams | SR-01; F-02, F-03, F-04 | 1 (re-verified each sprint) | AC-02-02, AC-02-03, AC-02-06, AC-02-10; AC-03-06, AC-03-07; AC-04-04, AC-04-07 | TEST-02-02, TEST-02-03, TEST-02-06, TEST-02-10; TEST-03-07, TEST-03-08; TEST-04-04, TEST-04-07 | `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts` | PASS (F-02..F-04 endpoints) | `35b29a7` |
| BR-03 Supervisor-only operations | SR-01; F-02, F-04 (Sprint 1); F-05, F-06, F-08, F-13 (later) | 1 | AC-01-07, AC-02-07, AC-03-08, AC-04-03 | TEST-01-10, TEST-02-07, TEST-03-10, TEST-04-03 | `server/tests/api/auth.api.test.ts`; `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts` | PASS (F-01 guard, F-02 create, F-03 student-only, F-04 feedback) | `35b29a7` |
| BR-04 Milestone validation, future deadline | F-02 (F-06 later) | 1 | AC-02-08 | TEST-02-08, TEST-02-11, TEST-02-15 | `server/tests/api/teams-milestones.api.test.ts`; `server/tests/unit/milestone-validation.test.ts`; `client/tests/Milestones.test.tsx` | PASS | `b97f30d` |
| BR-05 Late flag and days late | F-03 | 1 | AC-03-04 | TEST-03-04, TEST-03-05 | `server/tests/api/submissions.api.test.ts`; `server/tests/unit/submission-rules.test.ts` | PASS | `65aaf05` |
| BR-06 Sequential, unique versions | F-03 | 1 | AC-03-01, AC-03-02, AC-03-11 | TEST-03-01, TEST-03-02, TEST-03-14 | `server/tests/api/submissions.api.test.ts` | PASS | `65aaf05` |
| BR-07 Max 3 versions | F-03 | 1 | AC-03-03 | TEST-03-03, TEST-03-16; TEST-E2E-02 (#6) | `server/tests/api/submissions.api.test.ts`; `client/tests/Submissions.test.tsx`; `e2e/sprint1-rejection-journey.spec.ts` | PASS | `049bbfe` |
| BR-08 Submission validation | F-03 | 1 | AC-03-09 | TEST-03-11, TEST-03-12 | `server/tests/api/submissions.api.test.ts`; `server/tests/unit/submission-rules.test.ts` | PASS | `65aaf05` |
| BR-09 Feedback per version, append-only | F-04 (F-07 displays history) | 1 | AC-04-05, AC-04-06, AC-04-09 | TEST-04-05, TEST-04-06, TEST-04-09, TEST-04-10 | `server/tests/api/feedback.api.test.ts`; `server/tests/unit/feedback-validation.test.ts` | PASS | `35b29a7` |
| BR-10 One team per student | F-01 (seed + DB constraint); F-13 (UI) | 1, 3 | AC-01-09 | TEST-01-12 | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| BR-11 Grade visibility after release | F-08 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| BR-12 Derived status | F-09 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| BR-13 Deadline only extended | F-05 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| BR-14 Membership change keeps submitter | F-13 | 3 | Sprint 3 contract | — | — | PLANNED | — |

## 3. Non-functional requirements

| Requirement | Feature / responsibility | Sprint | Target / verification | Planned test | Actual test | Result | Version |
|---|---|---|---|---|---|---|---|
| NFR-01 Hashed passwords | F-01 | 1 | 100% bcrypt hashes, cost ≥ 10 | TEST-01-11 | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| NFR-02 401 on protected endpoints | SR-01 | 1 (extended each sprint) | Every protected endpoint, 4 token cases | TEST-01-07..08b, TEST-02-04, TEST-03-13, TEST-04-08 | `server/tests/api/auth.api.test.ts`; `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts` | PASS (F-01..F-04 endpoints) | `35b29a7` |
| NFR-03 Backend authorization | SR-01 | 1 (extended each sprint) | 403/404, no data | TEST-01-10, TEST-02-03, 06, 07, 10; TEST-03-08..10; TEST-04-03, TEST-04-04 | `server/tests/api/auth.api.test.ts`; `server/tests/api/teams-milestones.api.test.ts`; `server/tests/api/submissions.api.test.ts`; `server/tests/api/feedback.api.test.ts` | PASS (F-01..F-04) | `35b29a7` |
| NFR-04 Token expiry and logout | F-01 | 1 | ≤ 2 h; revoked after logout | TEST-01-09, TEST-01-08b | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| NFR-05 Safe error shape | SR-02 | 1 | JSON shape, no internals | Skeleton test `server/tests/health.api.test.ts` (404 case); F-01–F-04 STS | `health.api.test.ts` › unknown API route | PASS (404 case only) | `49d3c70` |
| NFR-06 Concurrent submissions | F-03 | 1 | 10 parallel → unique versions, limit kept | TEST-03-14 | `server/tests/api/submissions.api.test.ts` | PASS | `65aaf05` |
| NFR-07 Reproducible setup | SR-04 | 1 | README-only fresh setup | Teammate run before release (manual check, #6) | — | PLANNED | — |
| NFR-08 Durable data on GCP | SR-03 | 2 | Data survives restart/redeploy | Post-deployment check (Lab 5) | — | PLANNED | — |
| NFR-09 CI quality gate | SR-03 | 2 | Failing check blocks merge | CI run evidence (Lab 5) | — | PLANNED | — |
| NFR-10 Response time | SR-05 (with F-11) | 3 | p95 ≤ 500 ms on seeded dataset | Sprint 3 smoke test | — | PLANNED | — |
| NFR-11 Responsive UI | SR-06 | 3 | 375 px and 1280 px | Sprint 3 Playwright viewports | — | PLANNED | — |
| NFR-12 Understandable rejections | SR-02 | 1 (extended each sprint) | Reason shown for every rejection | TEST-02-15 (milestone validation); TEST-03-16 (version limit); TEST-04-12 (feedback validation); TEST-E2E-02 (#6) | `client/tests/Milestones.test.tsx`; `client/tests/Submissions.test.tsx`; `client/tests/Feedback.test.tsx`; `e2e/sprint1-rejection-journey.spec.ts` | PASS | `049bbfe` |

## 4. Coverage gaps

- No requirement is unallocated: all 23 FR, 14 BR and 12 NFR map to a feature or system responsibility and a sprint.
- F-01 AC and tests are implemented and passing on commit `d24f2c0`.
- F-02 AC and tests are implemented and passing on commit `b97f30d` (server tests on the separate `cpms_test` database).
- F-03 AC and tests are implemented and passing on commit `65aaf05`.
- F-04 AC and tests are implemented and passing on commit `35b29a7`.
- E2E #6 verified Sprint 1 normal domain journey (TEST-E2E-01) and rejection journey (TEST-E2E-02) on commit 049bbfe.
- Sprint 2–3 requirements have a feature and sprint but no AC or tests yet; this is expected at Deliverable 1.
- NFR-05 is partly verified (404 and F-01 validation/auth error shapes). 5xx cases come with later features.
- F-13 / FR-07 (team management) is planned for Sprint 3 as decided in D-06.

## 5. Approved changes

| Change ID | Date | Affected requirement/feature | Change | Rationale | Approved by |
|---|---|---|---|---|---|
| CHG-01 | 2026-11-05 | SDS §3.2; UI of F-01 and F-02 (login, header, student and supervisor pages); SR-06 / NFR-11 (partly earlier) | Add a shared stylesheet (`client/src/theme.css`) and replace inline styles in Sprint 1, inside #3 F-02 (PR #9). Responsive verification at 375 px / 1280 px stays in Sprint 3. No requirement, AC or test changes; all UI texts, labels and roles are unchanged. | When the team looked at the first working F-02 screens, they were too plain to use as Deliverable 1 evidence and for the cross-team UAT in Lab 6. Doing it now, before F-03 and F-04, means those features reuse the same classes instead of every screen being restyled at the end of Sprint 3. It was done in #3 rather than a new issue because F-02 created most of the screens and the change is small and UI-only. | ILoveSiesta (proposed); phet526 confirmed in the PR #9 review |
