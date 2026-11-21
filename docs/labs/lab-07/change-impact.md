# Lab 7: Change Impact Analysis — BR-05 late window (CR #59)

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-21 | ILoveSiesta | Impact analysis, unchanged-behaviour list and regression plan for change request #59 (CHG-03), written before implementation; for review by phet526 |

Change request: [#59](https://github.com/ILoveSiesta/Course-Project-Management-System/issues/59), approved by TA
Kantapat Suwannahong on 2026-11-21 13:20 ICT (Facebook Messenger). The §5/§6 clarification (interaction with the
F-05 deadline extension) was acknowledged by the TA the same day. Approved change ID: **CHG-03**
(`docs/traceability.md` §5).

## 1. Change summary

| | Rule |
|---|---|
| **Old (Sprint 1, accepted in `v0.1.2`)** | BR-05: submissions are accepted after the deadline but marked late, with no time limit; `daysLate = ceil((submittedAt − deadline) / 24 h)`. A student could submit 30 days late and get `201`, `daysLate = 30` (only the 3-version limit applied). |
| **New** | BR-05 (rev.): late submissions are accepted only while `submittedAt ≤ deadline + 7 × 24 h` (server time, inclusive). Later submissions get `409 SUBMISSION_WINDOW_CLOSED` ("Late submissions are accepted up to 7 days after the deadline") and nothing is stored. Accepted submissions have `daysLate` 0–7. |
| **Reason** | Supervisors need a fixed point after which a milestone's submissions are final so they can review and grade (F-08). |

### 1.1 Versions

| Item | Value |
|---|---|
| Accepted Sprint 1 baseline (old behaviour accepted by the partner team in Lab 6) | tag `v0.1.2` = `9dd9239`, Cloud Run revision `cpms-00008-qwd` |
| Original implementation of BR-05 | F-03, #4, PR #10, commit `65aaf05` |
| Pre-change implementation to be modified | `sprint-2` @ `41e7284` (the BR-05 code in `submissions.service.ts` and `submissionValidation.ts` is identical to `9dd9239`). The exact commit the RED run uses is recorded in #59 before the run. |
| Intervening development on `sprint-2` | PR #61 (`891d8ce`): CI trigger and Lab 6 documents, no code. PR #69 (`41e7284`): F-05 milestone edit / deadline extension (BR-13), which does not touch the submission code but moves the window when a deadline is extended (§3) |
| Contract revision (this document, SRS v0.7, F-03 contract v0.2, SDS v0.7, traceability v1.6) | branch `docs/lab7-br05-contract`, PR into `sprint-2`, reviewed by phet526 before any implementation commit |

## 2. Impact table

Status: **Changed** · **New** · **Unchanged (regression)** · **N/A** (with reason).

| Requirement | Feature | SRS | Feature SDS (F-03 contract v0.2) | System SDS | AC | STS test IDs | Code modules | Status |
|---|---|---|---|---|---|---|---|---|
| BR-05 late window | F-03 | BR-05, D-01 (rev. v0.7) | §2 BR-05, check order; §4 error | §1.3 rules table; §4 error codes | AC-03-04 (rev.), AC-03-14 | TEST-03-18 (unit), TEST-03-19 (API, fake clock) | `server/src/utils/submissionValidation.ts` (new `isWithinLateWindow`); `server/src/services/submissions.service.ts` `createSubmission()` | Changed |
| BR-05 days late calculation | F-03 | BR-05 (formula unchanged) | §2 BR-05 | §1.3 | AC-03-04 | TEST-03-04, TEST-03-05, TEST-03-18 | `calculateDaysLate()` | Unchanged (regression); bounded to 0–7 for new rows |
| BR-07 version limit precedence; check order (401/403/404/400) | F-03 | BR-07, BR-01, BR-03 | §2 order of the two 409 rules, check order | §4 check order | AC-03-15 (new); AC-03-03, AC-03-07..10 | TEST-03-20 (new); TEST-03-03, TEST-03-08..11, TEST-03-13 | `createSubmission()` (window check placed after the count check) | New test, behaviour unchanged |
| Historical data (`daysLate` > 7 stored before the change) | F-03 | BR-05 (last sentence) | §2 historical data; §5 no data change | §1.3 backstop note | AC-03-16 (new) | TEST-03-21 (new) | `listSubmissions()`, `getSubmission()` — no code change | New test, behaviour unchanged |
| BR-13 deadline extension moves the window | F-05 (with F-03) | BR-13 note | §2 deadline used; F-05 contract v0.3 note | — | AC-03-17 (new) | TEST-03-22 (new); TEST-05-06 (existing, stays inside the window) | No change: `createSubmission()` already reads the deadline inside the locked transaction | New test, no code change |
| FR-12 UI: closed-window notice, server 409 message | F-03 | FR-12 (rev.), NFR-12 | §3 UI states | §3.1 (no screen change) | AC-03-18 (new); AC-03-12 | TEST-03-23, TEST-03-24 (new); TEST-03-15, TEST-03-16 (fixture clock revised) | `client/src/components/StudentMilestone.tsx`; small helper for the window rule in `client/src/` | Changed |
| FR-13 view submissions | F-03 | FR-13 | §4 (GET unaffected) | §4.1 | AC-03-05, AC-03-06, AC-03-13, AC-03-16 | TEST-03-06, TEST-03-07, TEST-03-17, TEST-03-21 | none | Unchanged (regression) |
| F-04 feedback on versions | F-04 | FR-16, FR-17, BR-09 | — | — | AC-04-* | TEST-04-* (whole `feedback.api.test.ts`, `Feedback.test.tsx`) | none | Unchanged (regression): feedback can still be recorded on any version after the window closes; the window applies only to new submissions |
| Sprint 1 journeys | E2E | — | — | §9 | TEST-E2E-01, TEST-E2E-02 | TEST-03-25 (runs the existing E2E suite) | none | Unchanged (regression): journeys use future deadlines |

## 3. Items considered

| Area | Effect | Reason / handling |
|---|---|---|
| Callers / dependencies | Only `POST /api/milestones/:id/submissions` creates submissions; no other caller of `createSubmission()` | Rule added in one place; GET endpoints do not call it |
| API validation and errors | New `409 SUBMISSION_WINDOW_CLOSED` | Business rule that depends on stored state (deadline), so `409` after `400` (check order unchanged); `400` stays for invalid fields |
| UI validation | Notice replaces the form when the window is closed; server message shown on 409 | Browser time is only used to choose the notice; the server decides |
| Roles / ownership | N/A — unchanged | The window is checked after authentication, role and scope; supervisors still get `403`, other teams `404`, no token `401` (TEST-03-20). No new role can submit or override |
| Persistence / schema | N/A — no change | Window computed from existing `Milestone.deadline` and the submission time; no column added |
| Migrations | N/A — none | No schema change; Cloud Run migration job runs with no new migration |
| Historical data | Kept unchanged | No backfill or recalculation; rows with `daysLate` > 7 remain readable (TEST-03-21). No `daysLate <= 7` DB constraint, because such rows may exist |
| Concurrency / transaction | Window check inside the same transaction that locks the milestone row (`FOR UPDATE`) | The deadline is read under the lock; a concurrent F-05 `PATCH` (an `UPDATE` on the same row) waits for the lock, so a submission uses one consistent deadline. Version-number concurrency (NFR-06, TEST-03-14) unchanged |
| Time source / precision | Server clock, milliseconds, fixed 168 h | Same convention as `daysLate` (A-04); boundary `deadline + 7 d` accepted, `+ 1 ms` rejected; tests use a fake `Date` clock (TA request) |
| F-05 deadline extension | Moves the window, can reopen it | Clarified in #59 §5/§6 and acknowledged by the TA; tested by TEST-03-22; F-05 code unchanged |
| F-02 milestone creation | N/A — unchanged | Creation still requires a future deadline (BR-04), so a new milestone always starts with an open window |
| Planned features | F-08 grades benefit from final submissions; F-09 status should treat "Overdue" with the window in mind | Noted for the F-09 contract (#67); no change to F-06/F-07 |
| Configuration / deployment | N/A — no change | The 7-day value is a constant, not an environment variable (configurable windows are out of scope); Docker, CI and the Deploy demo pipeline unchanged |
| Seed data | N/A — no change | The seed creates no milestones or submissions |
| Lab 6 UAT cases | N/A — still valid | UAT-03 submits a few minutes after the deadline (inside the window); Final re-test uses the same cases |

## 4. Behaviour that must remain unchanged and how it is protected

| Unchanged behaviour | Protecting tests (existing unless marked) |
|---|---|
| On-time and up-to-7-days-late submissions are accepted with the same `daysLate` values | TEST-03-01, TEST-03-04, TEST-03-05; TEST-03-18/19 (new boundary) |
| Versions 1→2→3, earlier versions untouched, 4th rejected; version limit wins over the window | TEST-03-02, TEST-03-03, TEST-03-16; TEST-03-20 (new) |
| Concurrent submissions never duplicate versions | TEST-03-14 |
| Access: 401 without token, 403 for supervisors, 404 for other teams, on open and closed milestones | TEST-03-08..10, TEST-03-13; TEST-03-20 (new, closed window) |
| Field validation | TEST-03-11, TEST-03-12; TEST-03-20 (new, closed window) |
| Reading submissions and stored `daysLate` (including > 7) | TEST-03-06, TEST-03-07, TEST-03-17; TEST-03-21 (new) |
| Feedback on versions and its visibility | `server/tests/api/feedback.api.test.ts`, `server/tests/unit/feedback-validation.test.ts`, `client/tests/Feedback.test.tsx` |
| Milestone edit/extension and stored `daysLate` after an extension | `server/tests/api/milestone-edit.api.test.ts` (TEST-05-01..07), `client/tests/MilestoneEdit.test.tsx`; TEST-03-22 (new) |
| Authentication, teams, milestone creation | `auth.api.test.ts`, `teams-milestones.api.test.ts`, `client/tests/Auth.test.tsx`, `Milestones.test.tsx` |
| Sprint 1 journeys and the #54 fix | `e2e/sprint1-normal-journey.spec.ts`, `e2e/sprint1-rejection-journey.spec.ts`, `e2e/issue54-text-wrapping.spec.ts` (TEST-03-25) |

**Regression suite and why.** The whole automated suite is run on the GREEN commit, not a subset, because it is
small enough (server, client, E2E and `deploy/tests` take a few minutes) and the change touches the submission
transaction shared by F-03, F-04 (feedback targets these versions) and F-05 (deadline). Commands:
`npm run build`, `npm test`, `npm run test:e2e`, `python -m unittest discover -s deploy/tests`; CI
`test-and-docker` on the PR. Passed/failed/skipped counts are recorded in the F-03 contract §8.1 and #59.

**Old expected results that change.** None of the existing assertions change. Only the fixture clock of TEST-03-15
and TEST-03-16 is fixed (their milestone deadline is 2026-11-08, which would fall outside the window when run
after 2026-11-15); the reason is recorded in F-03 contract §7.

## 5. Expected RED on the pre-change implementation

| Test | Expected failure on the pre-change commit |
|---|---|
| TEST-03-18 | `isWithinLateWindow` does not exist yet, so the unit file fails to import. This is the only test that fails for a missing function; the behavioural RED evidence comes from TEST-03-19, TEST-03-22 and TEST-03-23 |
| TEST-03-19 | second request returns `201` (stored, `daysLate 8`) instead of `409 SUBMISSION_WINDOW_CLOSED` |
| TEST-03-22 | control request returns `201` instead of `409` |
| TEST-03-23 | form is still shown instead of the notice |
| TEST-03-24 | expected to pass already (the page shows any API message); recorded honestly as passing at RED |
| TEST-03-20, TEST-03-21 | expected to pass already (behaviour that must not change); they are regression guards, not RED evidence |
