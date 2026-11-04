# Software Requirements Specification (SRS)

Course Project Management System — CPE334 Theme 6

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-03 | ILoveSiesta | Document skeleton |
| 0.2 | 2026-11-04 | ILoveSiesta | First full draft: context, actors, scope, FR/BR/NFR, assumptions, proposed decisions (pending review by phet526) |

## 1. Stakeholder problem and context

A course that runs group projects (chosen context: a university software engineering course, such as the
CPE334 group project, with tens of teams) assigns each student team to one or more supervisors (instructor
or teaching assistant).
Teams must deliver work at defined milestones (e.g. SRS, Sprint 1 release, final report) and receive feedback.

Today this happens through scattered channels (chat messages, shared drives, e-mail). Supervisors cannot see
at a glance which teams have submitted, which version they reviewed, or whether feedback was given; students
cannot see a single, authoritative record of what they submitted and what the supervisor said about it.

The system gives each team one place to submit milestone work as links, keeps every revision, records
supervisor feedback against the exact version reviewed, and shows progress across milestones.

## 2. Actors and responsibilities

| Actor | Description | Responsibilities in the system |
|---|---|---|
| Student | A course student who is a member of exactly one project team | View own team and its milestones; submit and revise milestone work for own team; view own team's submissions, feedback and released grades; view own team's progress |
| Supervisor | An instructor or teaching assistant assigned to supervise one or more teams | View assigned teams; create and maintain milestones for assigned teams; review submissions; record feedback and grades; release grades; view progress and summary reports of assigned teams; manage team membership (Sprint 2) |
| System operator (outside the application UI) | Course staff who prepare the deployment | Create accounts, teams and supervisor assignments through the documented seed procedure; configure environment variables |

Each account has exactly one role (Student or Supervisor). Multiple roles per account are not supported.

## 3. Scope

### 3.1 In scope

- Login, logout, current-user identity, role-based access enforced by the backend
- Teams, team membership and supervisor assignment (seeded in Sprint 1; maintained by supervisors from Sprint 2)
- Milestones per team with a deadline
- Link-based submissions with title, description and URL; revision history (versions)
- Feedback on a specific submission version; grades with controlled release
- Milestone status per team, progress board and supervisor summary report
- Persistent PostgreSQL storage, reproducible synthetic seed data, Docker packaging and GCP deployment

### 3.2 Explicit exclusions

- Self-registration, password recovery, e-mail verification, account administration UI
- File upload or storage of submission content (submissions are links to external storage such as GitHub or Google Drive)
- E-mail, chat or push notifications; external messaging services
- Integration with LEB2 or any other LMS, plagiarism checking, external APIs
- Multiple courses or semesters in one deployment
- Peer evaluation between students

## 4. Functional Requirements (FR)

Sprint = the sprint planned to implement the requirement (see `docs/sprints/plan.md`).

### 4.1 Authentication and identity

| ID | Requirement | Actor | Sprint |
|---|---|---|---|
| FR-01 | A user can log in with e-mail and password and receives an access token and their profile (name, role). | All | 1 |
| FR-02 | A logged-in user can retrieve their current identity (`/me`) using the token. | All | 1 |
| FR-03 | A user can log out; the token used for the session is no longer accepted afterwards. | All | 1 |
| FR-04 | After login the UI routes the user to the home page for their role. | All | 1 |

### 4.2 Teams

| ID | Requirement | Actor | Sprint |
|---|---|---|---|
| FR-05 | A student can view their own team: name, members and assigned supervisors. | Student | 1 |
| FR-06 | A supervisor can list the teams assigned to them with their members. | Supervisor | 1 |
| FR-07 | A supervisor can create a team (which is assigned to them) and add or remove student members. | Supervisor | 2 |

### 4.3 Milestones

| ID | Requirement | Actor | Sprint |
|---|---|---|---|
| FR-08 | A supervisor can create a milestone (title, description, deadline) for a team assigned to them. | Supervisor | 1 |
| FR-09 | A student can list their team's milestones; a supervisor can list milestones of their assigned teams. Lists are ordered by deadline. | All | 1 |
| FR-10 | A supervisor can edit a milestone's title and description and extend its deadline. | Supervisor | 2 |
| FR-11 | A supervisor can create the same milestone for several of their assigned teams in one action. | Supervisor | 2 |

### 4.4 Submissions

| ID | Requirement | Actor | Sprint |
|---|---|---|---|
| FR-12 | A student can submit work for a milestone of their own team with a title, description and link. | Student | 1 |
| FR-13 | A student can view the persisted submission(s) of their team for a milestone; a supervisor can view submissions of assigned teams. | All | 1 |
| FR-14 | A student can resubmit before the deadline; each submission is stored as a new version and earlier versions are kept. | Student | 1 |
| FR-15 | Users can view the full revision history of a team's milestone (all versions with their feedback). | All | 2 |

### 4.5 Feedback and grades

| ID | Requirement | Actor | Sprint |
|---|---|---|---|
| FR-16 | A supervisor can record written feedback on a specific submission version of an assigned team. | Supervisor | 1 |
| FR-17 | Students can view feedback recorded on their team's submissions. | Student | 1 |
| FR-18 | A supervisor can record a grade for a team's milestone, linked to the submission version that was graded. | Supervisor | 2 |
| FR-19 | A supervisor can release the grades of a milestone; students can see a grade only after it is released. | Supervisor | 2 |

### 4.6 Progress and reporting

| ID | Requirement | Actor | Sprint |
|---|---|---|---|
| FR-20 | The system shows a status for each team–milestone pair (see BR-12). | All | 2 |
| FR-21 | A progress board shows milestone statuses: for a student, their team's milestones; for a supervisor, a teams × milestones view of assigned teams. | All | 3 |
| FR-22 | A supervisor can view a summary report of assigned teams: counts of submitted, missed and awaiting-feedback milestones and the average released grade per team. | Supervisor | 3 |
| FR-23 | A supervisor can filter the submission list by team, milestone and status. | Supervisor | 3 |

## 5. Business Rules (BR)

| ID | Rule (testable statement) | Related FR | Sprint |
|---|---|---|---|
| BR-01 | A student can read milestones, submissions, feedback and released grades, and create submissions, only for the team they belong to. Requests for another team's records are rejected without returning the records. | FR-05, FR-09, FR-12–FR-17 | 1 |
| BR-02 | A supervisor can read or act on a team's records only if they are assigned to that team. | FR-06, FR-08–FR-11, FR-13, FR-16, FR-18, FR-19 | 1 |
| BR-03 | Only supervisors can create or change milestones, feedback, grades and teams. A student calling these operations is rejected (403) and nothing is stored. | FR-07, FR-08, FR-10, FR-11, FR-16, FR-18, FR-19 | 1 |
| BR-04 | A milestone requires a title (1–120 characters) and a deadline that is later than the current server time when the milestone is created. Description is optional (≤ 2000 characters). | FR-08, FR-11 | 1 |
| BR-05 | A submission is accepted only if the server time at the moment of submission is not later than the milestone deadline. Late submissions are rejected and nothing is stored (D-01). | FR-12, FR-14 | 1 |
| BR-06 | Each accepted submission of a team for a milestone gets version = previous version + 1, starting at 1. Versions are never overwritten or deleted. Two simultaneous submissions never receive the same version number. | FR-12, FR-14 | 1 |
| BR-07 | A team can have at most 3 submission versions per milestone. A 4th submission is rejected (D-02). | FR-14 | 1 |
| BR-08 | A submission requires a title (1–120 characters) and an absolute `http` or `https` link (≤ 2048 characters). Description is optional (≤ 2000 characters). | FR-12, FR-14 | 1 |
| BR-09 | Feedback belongs to exactly one submission version and cannot be edited or deleted. A later resubmission does not move, change or remove feedback on earlier versions. | FR-16, FR-17, FR-15 | 1 |
| BR-10 | A student belongs to at most one team (D-05). Adding a student who already has a team is rejected. | FR-07 | 1 (seed), 2 (UI) |
| BR-11 | A grade is an integer from 0 to 100. Each team–milestone has at most one grade; recording again replaces the unreleased grade. Students cannot see a grade until the supervisor releases the milestone's grades; after release the grade can no longer be changed (D-03). | FR-18, FR-19 | 2 |
| BR-12 | Team–milestone status is derived: **Not submitted** (no version, deadline not passed); **Missed** (no version, deadline passed); **Submitted** (latest version has no feedback); **Reviewed** (latest version has feedback). | FR-20–FR-22 | 2 |
| BR-13 | A milestone deadline can only be moved later, never earlier, once the milestone exists. | FR-10 | 2 |
| BR-14 | Removing a student from a team does not remove or reassign submissions they made; history keeps the original submitter. | FR-07 | 2 |

## 6. Non-Functional Requirements (NFR)

| ID | Category | Requirement | Measurable target | Verification method | Sprint |
|---|---|---|---|---|---|
| NFR-01 | Security | Passwords are never stored in plaintext. | 100% of stored passwords are bcrypt hashes (cost ≥ 10) | Integration test reads seeded users and checks hash format; code review | 1 |
| NFR-02 | Security | Protected endpoints reject unauthenticated requests. | Every protected endpoint returns 401 with no private data for a missing, malformed, expired or logged-out token | API test iterating over the list of protected endpoints | 1 (extended each sprint) |
| NFR-03 | Security | Authorization is enforced by the backend, not the UI. | Every cross-team and wrong-role request returns 403/404 and no record data | API tests per feature (student → other team, supervisor → unassigned team, student → supervisor operation) | 1 (extended each sprint) |
| NFR-04 | Security | Sessions expire. | Access tokens expire after at most 2 hours; a token is rejected after logout | API tests with an expired token and a logged-out token | 1 |
| NFR-05 | Reliability | API errors are safe and consistent. | All 4xx/5xx responses use `{ error: { code, message } }` and contain no stack trace or SQL text | API tests for validation, not-found and forced-error cases | 1 |
| NFR-06 | Integrity | Concurrent submissions do not corrupt versions. | 10 parallel submissions by the same team produce unique consecutive versions, never exceeding the BR-07 limit | Integration test firing parallel requests against PostgreSQL | 1 |
| NFR-07 | Reproducibility | A new developer can run the system from the README. | Fresh clone → running app with seed data using only README commands | Teammate follows README on a clean machine/container before each release | 1 |
| NFR-08 | Durability | Data survives application restart and redeployment. | Records created before a restart/redeploy are retrievable afterwards | Post-deployment check on GCP (Lab 5) | 2 |
| NFR-09 | Delivery | Changes are checked before release. | Every PR runs build + automated tests in CI; a failing required check blocks merge | CI configuration and a demonstrated failing check (Lab 5) | 2 |
| NFR-10 | Performance | List and report pages respond quickly with realistic data. | p95 API response ≤ 500 ms for list/report endpoints with 20 teams, 10 milestones each and 3 versions per milestone | Automated smoke test measuring response times against a seeded dataset | 3 |
| NFR-11 | Usability | Main screens work on phone and desktop. | All Sprint screens usable without horizontal scrolling at 375 px and 1280 px widths | Playwright journeys run at both viewport sizes with screenshots | 3 |
| NFR-12 | Usability | Users understand failures. | Every rejected action in the UI shows a message explaining the reason (e.g. "Deadline has passed") | E2E rejection journeys; UAT (Lab 6) | 1 (extended each sprint) |

## 7. Assumptions

| ID | Assumption |
|---|---|
| A-01 | The deployment serves one course offering; all teams, milestones and accounts belong to it. |
| A-02 | Accounts, teams and supervisor assignments for Sprint 1 are created by the documented seed procedure, not through the UI. |
| A-03 | Submission links point to external storage (GitHub, Google Drive, etc.). The system validates the URL format but does not check that the link is reachable or inspect its content. |
| A-04 | Deadlines are stored in UTC and displayed in the Asia/Bangkok time zone. The server clock is authoritative for deadline checks. |
| A-05 | Instructors and teaching assistants have the same Supervisor permissions; scope is limited only by team assignment. |
| A-06 | All data in development, testing and demos is synthetic. |

## 8. Decisions and open questions

Status: **Proposed** = drafted by ILoveSiesta, awaiting phet526 review in the DOCS PR; **Agreed** = accepted by both; **Confirm with TA** = needs instructor/TA confirmation.

| ID | Question | Decision / resolution | Status | Date |
|---|---|---|---|---|
| D-01 | Can a team submit after the milestone deadline? | No. Late submissions are rejected (BR-05). Supervisors can extend a deadline instead (FR-10, BR-13). | Proposed | 2026-11-04 |
| D-02 | How many revisions are allowed per milestone? | Up to 3 versions per team per milestone, only before the deadline (BR-06, BR-07). | Proposed | 2026-11-04 |
| D-03 | When may students see feedback and grades? | Feedback is visible to the team as soon as it is recorded. Grades are hidden until the supervisor releases them for the milestone (BR-11). | Proposed | 2026-11-04 |
| D-04 | Can a team have more than one supervisor? | Yes. A team has one or more assigned supervisors; any of them may act on the team (BR-02). | Proposed | 2026-11-04 |
| D-05 | Can a student be in more than one team? | No. A student belongs to at most one team (BR-10). | Proposed | 2026-11-04 |
| D-06 | Who manages teams if there is no administrator role? | Seeded in Sprint 1; from Sprint 2 a supervisor creates teams they supervise and manages their members (FR-07). | Proposed; Confirm with TA | 2026-11-04 |
| D-07 | What does a submission contain? | Title, optional description and one link; no file upload (A-03). | Proposed | 2026-11-04 |
| D-08 | Can feedback be edited? | No. Feedback is append-only; a supervisor adds a new feedback entry to correct or extend earlier feedback (BR-09). | Proposed | 2026-11-04 |
| D-09 | How does logout work with tokens? | Logout revokes the current token on the server so it is rejected even before it expires (FR-03, NFR-04). Details in the System SDS. | Proposed | 2026-11-04 |
