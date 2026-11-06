# Feature Inventory

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | | Document skeleton |
| 0.2 | 2026-11-04 | ILoveSiesta | Full inventory for Sprints 1–3 based on SRS v0.3 and SDS v0.2 |
| 0.3 | 2026-11-04 | phet526 | F-01 status updated to Implemented |
| 0.4 | 2026-11-05 | ILoveSiesta | F-02 status updated to Implemented |
| 0.5 | 2026-11-06 | phet526 | F-03 status updated to Implemented |
| 0.6 | 2026-11-06 | ILoveSiesta | F-04 status updated to Implemented |

Requirement IDs refer to `docs/srs.md`. Sprint 1 features have GitHub issues and engineering contracts in
`docs/sprints/sprint-1/`. Sprint 2–3 features are allocated now and specified in their sprint.

Status values: **Planned** · **In progress** · **Implemented** · **Tested** · **Accepted**

## 1. Product features

| Feature | Name | Description | Requirements | Depends on | Sprint | Issue | Status |
|---|---|---|---|---|---|---|---|
| F-01 | Authentication and team data | Login, logout, current user, role guard; models User, Team, TeamMembership, SupervisorAssignment, RevokedToken; seed data | FR-01–FR-04, BR-10 (seed), NFR-01, NFR-04 | — | 1 | #2 | Implemented |
| F-02 | Team view and milestone creation | Student sees own team; supervisor lists assigned teams; supervisor creates milestones for assigned teams; milestone lists | FR-05, FR-06, FR-08, FR-09, BR-01–BR-04 | F-01 | 1 | #3 | Implemented |
| F-03 | Submission and versions | Student submits title/description/link; resubmission creates versions (max 3); late flag and days late; view submissions | FR-12–FR-14, BR-01, BR-02, BR-05–BR-08, NFR-06 | F-02 | 1 | #4 | Implemented |
| F-04 | Feedback | Supervisor records append-only feedback on a submission version; team sees feedback | FR-16, FR-17, BR-01–BR-03, BR-09 | F-03 | 1 | #5 | Implemented |
| F-05 | Milestone editing and deadline extension | Edit title/description; extend deadline only | FR-10, BR-13 | F-02 | 2 | — | Planned |
| F-06 | Milestone for several teams | Create the same milestone for several assigned teams in one action | FR-11, BR-04 | F-02 | 2 | — | Planned |
| F-07 | Revision history | Full version history per team–milestone with feedback on each version | FR-15, BR-09 | F-03, F-04 | 2 | — | Planned |
| F-08 | Grades and release | Record a grade per team–milestone; release grades; students see released grades only | FR-18, FR-19, BR-11 | F-03 | 2 | — | Planned |
| F-09 | Team–milestone status | Derived status (Not submitted, Overdue, Submitted, Submitted late, Reviewed) shown on lists | FR-20, BR-12 | F-03, F-04 | 2 | — | Planned |
| F-10 | Progress board | Student: own team's milestones by status; supervisor: teams × milestones board | FR-21 | F-09 | 3 | — | Planned |
| F-11 | Supervisor summary report | Per-team counts by status, late submissions, average released grade | FR-22, NFR-10 | F-08, F-09 | 3 | — | Planned |
| F-12 | Submission filtering | Filter supervisor submission list by team, milestone and status | FR-23 | F-09 | 3 | — | Planned |
| F-13 | Team management | Supervisor creates teams they supervise and manages members (scope to confirm with TA, D-06) | FR-07, BR-10, BR-14 | F-01 | 3 | — | Planned |

## 2. System responsibilities (cross-cutting)

These are not user features; they are established in one sprint and re-verified whenever a feature adds endpoints or screens.

| ID | Responsibility | Requirements | Established | Re-verified |
|---|---|---|---|---|
| SR-01 | Access control: authentication on every protected endpoint, role checks and record scope in services | BR-01, BR-02, BR-03, NFR-02, NFR-03 | Sprint 1 (F-01 middleware; F-02–F-04 scope checks) | Every feature that adds an endpoint |
| SR-02 | Safe and understandable errors: JSON error shape without internals; UI shows the reason | NFR-05, NFR-12 | Sprint 1 (skeleton + F-01–F-04) | Every feature |
| SR-03 | Delivery pipeline: Docker image, CI checks on PRs, GCP deployment with durable database | NFR-08, NFR-09 | Sprint 2 (Lab 5) | Each release |
| SR-04 | Reproducible setup: README, `.env.example`, migrations and seed | NFR-07 | Sprint 1 (release of #6) | Each release |
| SR-05 | Performance of list and report endpoints | NFR-10 | Sprint 3 (with F-11) | Final release |
| SR-06 | Responsive UI at phone and desktop widths | NFR-11 | Sprint 3 | Final release |

## 3. Sprint 1 verification work

| Item | Purpose | Issue |
|---|---|---|
| E2E journeys | Normal journey (supervisor creates milestone → student submits → supervisor gives feedback → student sees it) and one rejection journey; release checklist for `v0.1.0` | #6 |
