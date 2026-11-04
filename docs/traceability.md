# Requirements Traceability Matrix

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |
| 0.2 | 2026-11-04 | ILoveSiesta | Every FR/BR/NFR in SRS v0.3 mapped to a feature or system responsibility and a sprint |
| 0.3 | 2026-11-04 | phet526 | Updated F-01 test executions and verification results (PASS on feature/F-01-auth) |
| 0.4 | 2026-11-04 | phet526 | Updated test references and exact commit SHA (d24f2c0) per PR #8 review |

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
| FR-05 Student views own team | F-02 | 1 | F-02 contract | F-02 STS | — | PLANNED | — |
| FR-06 Supervisor lists assigned teams | F-02 | 1 | F-02 contract | F-02 STS | — | PLANNED | — |
| FR-07 Team management | F-13 | 3 | Sprint 3 contract | — | — | PLANNED | — |
| FR-08 Create milestone | F-02 | 1 | F-02 contract | F-02 STS; E2E (#6) | — | PLANNED | — |
| FR-09 List milestones | F-02 | 1 | F-02 contract | F-02 STS | — | PLANNED | — |
| FR-10 Edit / extend milestone | F-05 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-11 Milestone for several teams | F-06 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-12 Submit work | F-03 | 1 | F-03 contract | F-03 STS; E2E (#6) | — | PLANNED | — |
| FR-13 View submissions, late flag | F-03 | 1 | F-03 contract | F-03 STS; E2E (#6) | — | PLANNED | — |
| FR-14 Resubmit as new version | F-03 | 1 | F-03 contract | F-03 STS | — | PLANNED | — |
| FR-15 Revision history | F-07 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-16 Record feedback | F-04 | 1 | F-04 contract | F-04 STS; E2E (#6) | — | PLANNED | — |
| FR-17 Students view feedback | F-04 | 1 | F-04 contract | F-04 STS; E2E (#6) | — | PLANNED | — |
| FR-18 Record grade | F-08 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-19 Release grades | F-08 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-20 Team–milestone status | F-09 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| FR-21 Progress board | F-10 | 3 | Sprint 3 contract | — | — | PLANNED | — |
| FR-22 Summary report | F-11 | 3 | Sprint 3 contract | — | — | PLANNED | — |
| FR-23 Filter submissions | F-12 | 3 | Sprint 3 contract | — | — | PLANNED | — |

## 2. Business rules

| Requirement | Feature / responsibility | Sprint | AC / verification | Planned test | Actual test | Result | Version |
|---|---|---|---|---|---|---|---|
| BR-01 Student scope: own team | SR-01; F-02, F-03, F-04 | 1 (re-verified each sprint) | Cross-team access AC in F-02–F-04 contracts | F-02–F-04 STS | — | PLANNED | — |
| BR-02 Supervisor scope: assigned teams | SR-01; F-02, F-03, F-04 | 1 (re-verified each sprint) | Unassigned-supervisor AC in F-02–F-04 contracts | F-02–F-04 STS | — | PLANNED | — |
| BR-03 Supervisor-only operations | SR-01; F-02, F-04 (Sprint 1); F-05, F-06, F-08, F-13 (later) | 1 | AC-01-07; Student → 403 in F-02, F-04 contracts | TEST-01-10; F-02, F-04 STS | `server/tests/api/auth.api.test.ts` | PASS (F-01 guard) | `d24f2c0` |
| BR-04 Milestone validation, future deadline | F-02 (F-06 later) | 1 | F-02 contract | F-02 STS | — | PLANNED | — |
| BR-05 Late flag and days late | F-03 | 1 | F-03 contract | F-03 STS (unit + API) | — | PLANNED | — |
| BR-06 Sequential, unique versions | F-03 | 1 | F-03 contract | F-03 STS | — | PLANNED | — |
| BR-07 Max 3 versions | F-03 | 1 | F-03 contract | F-03 STS; E2E rejection (#6) | — | PLANNED | — |
| BR-08 Submission validation | F-03 | 1 | F-03 contract | F-03 STS | — | PLANNED | — |
| BR-09 Feedback per version, append-only | F-04 (F-07 displays history) | 1 | F-04 contract | F-04 STS | — | PLANNED | — |
| BR-10 One team per student | F-01 (seed + DB constraint); F-13 (UI) | 1, 3 | AC-01-09 | TEST-01-12 | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| BR-11 Grade visibility after release | F-08 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| BR-12 Derived status | F-09 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| BR-13 Deadline only extended | F-05 | 2 | Sprint 2 contract | — | — | PLANNED | — |
| BR-14 Membership change keeps submitter | F-13 | 3 | Sprint 3 contract | — | — | PLANNED | — |

## 3. Non-functional requirements

| Requirement | Feature / responsibility | Sprint | Target / verification | Planned test | Actual test | Result | Version |
|---|---|---|---|---|---|---|---|
| NFR-01 Hashed passwords | F-01 | 1 | 100% bcrypt hashes, cost ≥ 10 | TEST-01-11 | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| NFR-02 401 on protected endpoints | SR-01 | 1 (extended each sprint) | Every protected endpoint, 4 token cases | TEST-01-07, TEST-01-08, TEST-01-08b | `server/tests/api/auth.api.test.ts` | PASS (F-01 routes) | `d24f2c0` |
| NFR-03 Backend authorization | SR-01 | 1 (extended each sprint) | 403/404, no data | TEST-01-10; F-02–F-04 STS | `server/tests/api/auth.api.test.ts` | PASS (F-01 guards) | `d24f2c0` |
| NFR-04 Token expiry and logout | F-01 | 1 | ≤ 2 h; revoked after logout | TEST-01-09, TEST-01-08b | `server/tests/api/auth.api.test.ts` | PASS | `d24f2c0` |
| NFR-05 Safe error shape | SR-02 | 1 | JSON shape, no internals | Skeleton test `server/tests/health.api.test.ts` (404 case); F-01–F-04 STS | `health.api.test.ts` › unknown API route | PASS (404 case only) | `49d3c70` |
| NFR-06 Concurrent submissions | F-03 | 1 | 10 parallel → unique versions, limit kept | F-03 STS (integration) | — | PLANNED | — |
| NFR-07 Reproducible setup | SR-04 | 1 | README-only fresh setup | Teammate run before release (manual check, #6) | — | PLANNED | — |
| NFR-08 Durable data on GCP | SR-03 | 2 | Data survives restart/redeploy | Post-deployment check (Lab 5) | — | PLANNED | — |
| NFR-09 CI quality gate | SR-03 | 2 | Failing check blocks merge | CI run evidence (Lab 5) | — | PLANNED | — |
| NFR-10 Response time | SR-05 (with F-11) | 3 | p95 ≤ 500 ms on seeded dataset | Sprint 3 smoke test | — | PLANNED | — |
| NFR-11 Responsive UI | SR-06 | 3 | 375 px and 1280 px | Sprint 3 Playwright viewports | — | PLANNED | — |
| NFR-12 Understandable rejections | SR-02 | 1 (extended each sprint) | Reason shown for every rejection | E2E rejection journey (#6) | — | PLANNED | — |

## 4. Coverage gaps

- No requirement is unallocated: all 23 FR, 14 BR and 12 NFR map to a feature or system responsibility and a sprint.
- F-01 AC and tests are implemented and passing on commit `d24f2c0`.
- Sprint 1 features F-02–F-04 and E2E #6 will add their AC and tests in their respective branches.
- Sprint 2–3 requirements have a feature and sprint but no AC or tests yet; this is expected at Deliverable 1.
- NFR-05 is partly verified (404 and F-01 validation/auth error shapes). 5xx cases come with later features.
- F-13 / FR-07 depends on D-06; if the TA confirms that no team-management UI is required, FR-07 will be revised as an approved change below.

## 5. Approved changes

| Change ID | Date | Affected requirement/feature | Change | Rationale | Approved by |
|---|---|---|---|---|---|
| — | — | — | None yet (baseline being established) | — | — |
