# Sprint 1 End-to-End Journeys and Release Readiness Specification

> This specification defines the Sprint 1 system-level verification, Playwright end-to-end (E2E) journeys,
> and the release readiness checklist for `v0.1.0` (Issue #6).

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-06 | phet526 | Initial specification for Sprint 1 E2E journeys and release checklist (issue #6) |

## 1. Linked requirements

- **FR:** FR-01 (login), FR-02 (logout), FR-03 (current user), FR-04 (role-based home), FR-05 (student view team), FR-06 (supervisor view teams), FR-08 (create milestone), FR-09 (list milestones), FR-12 (submit work), FR-13 (view submissions, late badge), FR-14 (resubmit as version), FR-16 (record feedback), FR-17 (view feedback)
- **BR:** BR-01 (student scope), BR-02 (supervisor scope), BR-03 (role-restricted operations), BR-04 (milestone validation, future deadline), BR-05 (late calculation), BR-06 (version numbers 1..3), BR-07 (max 3 versions), BR-08 (submission validation), BR-09 (feedback comment 1..5000 chars, append-only, kept across versions)
- **NFR:** NFR-01 (password hashing), NFR-02 (401 on protected endpoints), NFR-03 (403/404 without data disclosure), NFR-04 (token lifecycle), NFR-05 (safe error shape), NFR-06 (concurrency safety), NFR-07 (reproducible setup), NFR-12 (understandable rejections)
- **Decisions:** D-01 (late submissions marked), D-02 (max 3 versions), D-03 (feedback visible immediately), D-06 (team management scope), D-07 (submission contents: title, description, link), D-08 (feedback append-only), D-09 (token revocation on logout)

## 2. E2E Journeys Design

The E2E tests run in a real browser using Playwright against the full application stack (React client on port 5173, Express API on port 3000, PostgreSQL database).

### 2.1 Journey 1: Normal Domain Journey (`e2e/sprint1-normal-journey.spec.ts`)
1. **Supervisor creates milestone:** Supervisor 1 logs in, navigates to assigned Team Alpha (`/supervisor/teams/1`), fills the milestone form with a future deadline and submits. The milestone appears in the team's milestone list formatted in ICT.
2. **Student submits work:** Student 1 logs in, sees the newly created milestone under Team Alpha on `/student`, navigates to `/student/milestones/:id`, and submits Version 1 (title, description, link). The submission is persisted and listed with version 1, "On time" badge, author name, and link.
3. **Supervisor reviews and gives feedback:** Supervisor 1 logs in, navigates to the milestone detail page (`/supervisor/milestones/:id`), views Version 1, and submits feedback on Version 1. The feedback is persisted and displayed immediately under Version 1 with author name and ICT timestamp.
4. **Student views feedback:** Student 1 logs in, opens the milestone page, and sees the supervisor's feedback under Version 1. Student has no feedback submission form (read-only).

### 2.2 Journey 2: Rejection and Access Control Journey (`e2e/sprint1-rejection-journey.spec.ts`)
1. **Milestone validation rejection (BR-04, NFR-12):** Supervisor attempts to create a milestone with an empty title and a past deadline $\rightarrow$ form validation messages "Required" and "Deadline must be in the future" are displayed; milestone is not created.
2. **Submission validation rejection (BR-08, NFR-12):** Student attempts to submit with an invalid URL scheme (e.g. `ftp://...`) and empty title $\rightarrow$ validation messages "Required" and "Link must be an http or https URL" are displayed; submission is not created.
3. **Version limit rejection (BR-07, NFR-12):** Student submits 3 versions for a milestone. Upon reaching 3 versions, the submit form is removed and replaced by "Maximum of 3 versions reached for this milestone."
4. **Access control enforcement (BR-01, BR-02, BR-03, NFR-03):**
   - Unassigned supervisor (`supervisor2@cpms.test`) navigating directly to Team Alpha's milestone URL receives "Milestone not found or not allowed" (404 without data disclosure).
   - Cross-team student (`student3@cpms.test`, Team Beta) navigating directly to Team Alpha's milestone URL receives "Milestone not found or not allowed" (404 without data disclosure).

## 3. Acceptance Criteria

| AC ID | Scenario | Given / When / Then |
|---|---|---|
| AC-E2E-01 | Normal domain workflow | Given seeded test accounts, When supervisor creates milestone, student submits work, supervisor adds feedback, and student views feedback, Then each state transition persists and renders accurately in the UI. |
| AC-E2E-02 | Business-rule rejections | Given invalid milestone input (blank title, past deadline) or invalid submission input (invalid URL), When submitted, Then the UI explains the rejection under the corresponding field. |
| AC-E2E-03 | Version limit enforcement | Given a milestone with 3 existing versions, When student views the milestone, Then the submit form is replaced by the version limit notice. |
| AC-E2E-04 | Authorization & scope | Given an out-of-scope student or unassigned supervisor, When accessing another team's milestone URL directly, Then access is rejected with 404 without leaking team data. |

## 4. Software Test Specification (STS)

| Test ID | AC | Level | Description | File |
|---|---|---|---|---|
| `TEST-E2E-01` | AC-E2E-01 | E2E | Supervisor creates milestone → student submits v1 → supervisor gives feedback → student views feedback | `e2e/sprint1-normal-journey.spec.ts` |
| `TEST-E2E-02` | AC-E2E-02..04 | E2E | Validation rejections (milestone & submission), 3-version limit notice, cross-team student 404, unassigned supervisor 404 | `e2e/sprint1-rejection-journey.spec.ts` |

## 5. Release Readiness Checklist for `v0.1.0`

- [ ] All Sprint 1 features implemented (F-01, F-02, F-03, F-04)
- [ ] Automated tests passing on fresh database (`npm run build && npm test && npm run test:e2e`)
- [ ] Reproducible setup verified against README instructions
- [ ] Clean Git history with reviewed PRs (#8, #9, #10, #11) merged into `sprint-1`
- [ ] Documentation updated (`docs/srs.md`, `docs/system-sds.md`, `docs/features.md`, `docs/traceability.md`, `docs/sprints/plan.md`)
- [ ] Release PR `sprint-1` → `main` prepared and reviewed
- [ ] Release tag `v0.1.0` ready to tag
