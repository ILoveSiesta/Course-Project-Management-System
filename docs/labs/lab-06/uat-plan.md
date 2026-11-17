# Lab 6: Sprint 1 UAT Plan and Handoff (Product Team: CPMS)

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-17 | ILoveSiesta | UAT cases UAT-01 to UAT-07 and handoff for the Sprint 1 release (#49) |

This document is given to the independent UAT Team. It must be possible to run every case from this
document alone. Lab 6 handout §3.1 (Part A) asks for executable cases with stable IDs, Sprint 1
requirement/AC references, roles, preconditions, synthetic inputs, numbered actions and specific
expected results, plus a safe handoff.

## 1. Handoff

### 1.1 Product and teams

| Item | Value |
|---|---|
| Product | Course Project Management System (CPMS), theme 6: teams submit milestone work, supervisors give feedback |
| Product Team | ILoveSiesta, phet526 (GitHub) |
| UAT Team | Recorded when the handoff is sent (team, both students, date) |
| Repository | https://github.com/ILoveSiesta/Course-Project-Management-System |
| Deployed URL | https://cpms-6pjdhtz32a-as.a.run.app |

### 1.2 Release under test

| Item | Value |
|---|---|
| Sprint 1 baseline release | tag `v0.1.0`, commit `25211ac` (Deliverable 1) |
| Tested version | `main` @ `38dc25c` (Lab 5 release 3, PR #47): Sprint 1 behaviour plus Lab 5 packaging/deployment changes only; no Sprint 2 or 3 feature |
| Deployed revision | Cloud Run `cpms-00007-k5d`, deployed by GitHub Actions run 43726097082 |
| How to check the version on screen | Footer of every page shows `CPMS v0.1.1` |
| Contract that defines expected behaviour | `docs/sprints/sprint-1/` F-01 to F-04 contracts at `v0.1.0` (AC IDs below) |

The Product Team will **not** deploy anything during your test sessions. If a change must be deployed
(for example a defect fix), we will tell you first and give you the new commit and Cloud Run revision.
Results and acceptance apply only to the version you recorded.

### 1.3 Accepted-for-test scope (Sprint 1 only)

| Feature | What is in scope |
|---|---|
| F-01 Authentication | Log in, wrong password rejected, log out, role home page (`/student` or `/supervisor`) |
| F-02 Teams and milestones | Student sees own team, members, supervisors and milestones; supervisor sees only assigned teams and creates a milestone (title, description, future deadline) |
| F-03 Submissions | Student submits title/description/link for a milestone of own team; resubmission creates version 2 and 3; maximum 3 versions; late submissions are accepted and marked `Late (+N d)` |
| F-04 Feedback | Supervisor adds feedback to a specific version; student sees it; feedback stays on its version |

**Not in scope (do not report as Sprint 1 defects; you may still note them as enhancement suggestions):**
editing or deleting milestones, submissions or feedback; grades/scores; progress board and reports;
team management by supervisors; self-registration and password reset; mobile layout. These are planned
for Sprints 2 and 3.

### 1.4 Accounts

All accounts are synthetic seed data. **Passwords are sent to you privately, never in this document.**
All accounts use the same password.

| Label | Email (login) | Role | Team / scope |
|---|---|---|---|
| S1 | `student1@cpms.test` (Student One) | Student | Team Alpha |
| S2 | `student2@cpms.test` (Student Two) | Student | Team Alpha |
| S3 | `student3@cpms.test` (Student Three) | Student | Team Beta |
| SV1 | `supervisor1@cpms.test` (Supervisor One) | Supervisor | Team Alpha and Team Beta |
| SV2 | `supervisor2@cpms.test` (Supervisor Two) | Supervisor | Team Beta and Team Gamma (**not** Team Alpha) |

### 1.5 Test environment and data rules

- Use a desktop browser (Chrome or Edge, latest). Use a normal window for one account and a private
  (incognito) window for a second account at the same time. Each window keeps its own session.
- Times are shown in Thailand time with `(ICT)`. The deadline field uses your computer's time zone; set
  your computer to Asia/Bangkok (UTC+7) so the values in this document match the screen.
- The service scales to zero when idle. The first page load after a pause can take up to about 20
  seconds; this is not a defect. If a page has not loaded after 60 seconds, record the case as BLOCKED.
- **Data setup:** the seed has teams and accounts but no milestones. Each case creates its own milestone.
  Name every milestone `UAT-<your team>-<case ID>-<run>` (for example `UAT-T07-UAT02-1`) so cases do not
  share data and can be run again.
- **Cases are independent** and can run in any order, except UAT-06, which uses the milestone created in
  UAT-01 (stated in its preconditions).
- **Reset/cleanup:** Sprint 1 has no delete operation, so data cannot and need not be removed. Never reuse
  a milestone from an earlier run: a milestone accepts at most 3 versions. To repeat a case, create a new
  milestone with the next run number. Data on this deployment survives restarts and redeployments.
- Use only synthetic text and links (for example `https://example.com/...`). Do not enter real personal data.
- Do not put passwords or tokens in screenshots. Copying a token in UAT-05 and UAT-07 is optional; if you
  do, keep it out of screenshots and reports.

### 1.6 Recording results and reporting findings

For every run, record: case ID, tester name and team, date and time (ICT), tested version (footer text and
revision `cpms-00007-k5d`), the inputs you used, the **actual result in your own words**, and
PASS / FAIL / BLOCKED (with the reason if BLOCKED). Take at least one screenshot per case and give it an
evidence ID.

Report each failure as a GitHub Issue in our repository with the label `lab6` and title
`[UAT] <case ID>: <short summary>`, or, if you cannot open issues there, send the same fields through the
agreed chat and we will open the Issue and link it. Fields: reporter, tested version, linked case/AC,
preconditions/data, reproduction steps, expected result, actual result, severity, evidence.

Severity (by user impact):

| Severity | Meaning |
|---|---|
| Critical | Security or data problem: a user sees or changes another team's data, or a role does something it must not; or data is lost; or a main journey cannot be completed at all |
| Major | A Sprint 1 rule or main journey step gives a wrong result and there is no reasonable workaround |
| Minor | Wrong or unclear message, display or formatting problem; the user can still finish the task correctly |

## 2. Cases

| ID | Category (handout §3.1) | Title |
|---|---|---|
| UAT-01 | Normal domain journey | Milestone → submission → feedback → student reads feedback |
| UAT-02 | Business rule | At most 3 versions per milestone |
| UAT-03 | Boundary (deadline) | Past deadline rejected; work after the deadline is accepted as late |
| UAT-04 | Boundary (validation) | Field limits and link format |
| UAT-05 | Forbidden role / ownership | Other team's student and unassigned supervisor cannot see or change Team Alpha data |
| UAT-06 | State / history / persistence | Feedback stays on its version; data persists after logout and login |
| UAT-07 | Authentication | Wrong password, logout and session end |

### UAT-01 Normal journey: milestone, submission, feedback

- **References:** FR-01, FR-04, FR-05, FR-06, FR-08, FR-09, FR-12, FR-13, FR-16, FR-17; AC-01-11, AC-02-05, AC-02-11, AC-02-12, AC-03-01, AC-03-12, AC-03-13, AC-04-01, AC-04-10, AC-04-11
- **Purpose:** a supervisor creates work, a student submits it and receives feedback, using the real UI and database.
- **Roles/accounts:** SV1 (normal window), S1 (private window)
- **Preconditions:** none. Pick a deadline at least one day in the future.
- **Inputs:**
  - Milestone title `UAT-<team>-UAT01-<run>`, description `Sprint 1 UAT normal journey`, deadline tomorrow 23:59
  - Submission title `Draft report`, description `First version`, link `https://example.com/uat01-v1`
  - Feedback `Good start. Add the test plan.`

| Step | Action | Expected result |
|---|---|---|
| 1 | Open the URL, log in as SV1 | Supervisor Dashboard, "Welcome, Supervisor One!", cards **Team Alpha** and **Team Beta** only (no Team Gamma) |
| 2 | Click **Open team** on Team Alpha | Team Alpha page: supervisors "Supervisor One", members Student One and Student Two with emails, a **Milestones** list and a **New milestone** form |
| 3 | Enter the milestone inputs and click **Create milestone** | The form clears and the new milestone appears in the list with "Due: <date>, 23:59 (ICT)" |
| 4 | In the private window, log in as S1 | Student Dashboard, "Welcome, Student One!", card Team Alpha with the same members and supervisor; the new milestone is listed with the same deadline |
| 5 | Click the milestone title | Milestone page with title, due date and description; **Submissions** shows "No submissions yet."; a **Submit work** form |
| 6 | Enter the submission inputs and click **Submit work** | "Version 1: Draft report" appears with badge **On time**, "Submitted by: Student One at <time> (ICT)", the link, and "No feedback yet." under Feedback; the form heading becomes **Resubmit work** |
| 7 | In the SV1 window, open the milestone from the Team Alpha list | Supervisor milestone page shows Version 1 with submitter Student One, link and **On time**; a "Feedback for version 1" box and **Add feedback** button; no submission form |
| 8 | Enter the feedback and click **Add feedback** | The comment appears under version 1 with "by Supervisor One on <time> (ICT)" |
| 9 | In the S1 window, reload the page | The feedback text, "by Supervisor One" and its ICT time are shown under version 1; there is no feedback form for the student |

### UAT-02 Business rule: at most 3 versions

- **References:** BR-06, BR-07, FR-13, FR-14, NFR-12; AC-03-02, AC-03-03, AC-03-05, AC-03-12
- **Purpose:** versions are numbered 1, 2, 3, earlier versions are kept, and a 4th version is refused by the server.
- **Roles/accounts:** SV1, S1 and S2 (two different students of Team Alpha)
- **Preconditions:** SV1 has created milestone `UAT-<team>-UAT02-<run>` for Team Alpha with a deadline tomorrow.
- **Inputs:** titles `V1`, `V2`, `V3`, `V4`; links `https://example.com/uat02-v1` … `-v4`; description empty

| Step | Action | Expected result |
|---|---|---|
| 1 | As S1, open the milestone, submit `V1` with its link | "Version 1: V1" is listed |
| 2 | Submit `V2` with its link | "Version 2: V2" is listed below version 1; version 1 still shows title `V1` and its link (unchanged) |
| 3 | In the private window, log in as **S2** and open the same milestone | Versions 1 and 2 are listed (submitted by Student One); the **Resubmit work** form is shown |
| 4 | As S1 (normal window), submit `V3` | "Version 3: V3" is listed; the form is replaced by "Maximum of 3 versions reached for this milestone." |
| 5 | As S2 (private window, **do not reload**), enter `V4` with its link and click **Submit work** | The server refuses it: the message "Maximum of 3 versions reached for this milestone" appears above the form; no version 4 is added |
| 6 | As S2, reload the page | Exactly versions 1, 2 and 3 are listed, in that order; the form is replaced by the maximum-reached message |

### UAT-03 Boundary: deadline in the past and late submission

- **References:** BR-04, BR-05, D-01, FR-08, FR-12; AC-02-08 (deadline), AC-03-04, AC-03-12
- **Purpose:** a milestone cannot be created with a past deadline; work submitted after the deadline is accepted and marked late with whole days rounded up.
- **Roles/accounts:** SV1, S1
- **Preconditions:** none. You need about 5 minutes for this case.
- **Inputs:** milestone title `UAT-<team>-UAT03-<run>`; deadline A = yesterday 10:00; deadline B = current time + 3 minutes; submission title `Late work`, link `https://example.com/uat03`

| Step | Action | Expected result |
|---|---|---|
| 1 | As SV1 on Team Alpha, enter the title and deadline A, click **Create milestone** | "Deadline must be in the future" under Deadline; the milestone is **not** added to the list |
| 2 | Reload the Team Alpha page | Still no milestone with this title (nothing was stored) |
| 3 | Enter the same title with deadline B, click **Create milestone** | The milestone is created and listed with deadline B in ICT |
| 4 | Wait until deadline B has passed (check your clock; wait one more minute) | – |
| 5 | As S1, open the milestone and submit `Late work` with its link | The submission is accepted: "Version 1: Late work" with badge **Late (+1 d)** (any time up to 24 hours late counts as 1 day) |
| 6 | As SV1, open the milestone | Version 1 shows the same **Late (+1 d)** badge |

### UAT-04 Boundary: field limits and link format

- **References:** BR-04, BR-08, FR-08, FR-12, NFR-12; AC-02-08 (title/blank), AC-02-12, AC-03-09, AC-03-12
- **Purpose:** invalid input is refused with a message under the field and nothing is stored; the exact limit is accepted.
- **Roles/accounts:** SV1, S1
- **Preconditions:** none.
- **Inputs:**
  - T121 = 121 characters: the 120-character text below followed by `X`
  - T120 = exactly 120 characters: `UAT04-` followed by 114 letters `a` (generate it, for example in the browser console: `'UAT04-' + 'a'.repeat(114)`)
  - Link values: `not-a-link`, `ftp://example.com/file`, `https://example.com/uat04`

| Step | Action | Expected result |
|---|---|---|
| 1 | As SV1 on Team Alpha, leave all fields empty and click **Create milestone** | "Required" under Title and under Deadline; nothing is added |
| 2 | Enter title T121 and a deadline tomorrow; click **Create milestone** | "Too long (max 120 characters)" under Title; nothing is added |
| 3 | Change the title to T120 (same deadline); click **Create milestone** | The milestone is created and listed with the full 120-character title |
| 4 | As S1, open that milestone; enter title `Link test`, link `not-a-link`; click **Submit work** | "Link must be an http or https URL" under Link; "No submissions yet." remains |
| 5 | Change the link to `ftp://example.com/file`; click **Submit work** | The same link message; still no submission |
| 6 | Clear the title (link `https://example.com/uat04`); click **Submit work** | "Required" under Submission title; still no submission |
| 7 | Enter title `Link test` with link `https://example.com/uat04`; click **Submit work** | "Version 1: Link test" is stored and shown with the link |

### UAT-05 Forbidden role and ownership

- **References:** BR-01, BR-02, BR-03, NFR-03; AC-01-07, AC-02-03, AC-02-07, AC-03-07, AC-04-03, AC-04-04, AC-04-11
- **Purpose:** a student of another team and a supervisor not assigned to Team Alpha cannot see Team Alpha's milestone or submission, and a student cannot create milestones or feedback; the backend refuses, not only the UI.
- **Roles/accounts:** SV1, S1, S3, SV2
- **Preconditions:** a Team Alpha milestone with one submission and one feedback entry, for example from UAT-01. Write down from the address bar: the Team Alpha ID (`/supervisor/teams/<teamId>`, as SV1) and the milestone ID (`/student/milestones/<milestoneId>`, as S1).

| Step | Action | Expected result |
|---|---|---|
| 1 | Log in as **S3** (Team Beta). Look at the dashboard | Only Team Beta and its milestones; nothing from Team Alpha |
| 2 | As S3, type the address `/student/milestones/<milestoneId>` | "Milestone not found or not allowed"; no title, submission, link or feedback of Team Alpha is shown |
| 3 | As S3, type the address `/supervisor` | You are sent back to the Student Dashboard (no supervisor page) |
| 4 | Log out; log in as **SV2**. Look at the dashboard | Cards Team Beta and Team Gamma only; no Team Alpha |
| 5 | As SV2, type `/supervisor/teams/<teamId>` | "Team not found or not allowed"; no members, milestones or **New milestone** form |
| 6 | As SV2, type `/supervisor/milestones/<milestoneId>` | "Milestone not found or not allowed"; no submission or feedback form |
| 7 | Log out; log in as **S1**, open the milestone | The student sees the submission and the feedback but **no** "Add feedback" form, and the Team Alpha dashboard has **no** "New milestone" form |
| 8 | Backend check (optional but recommended). As S1, open the browser developer tools (F12) → Console and run the two commands in §2.1 with your IDs | Both print status **403** and `FORBIDDEN`; nothing is created |
| 9 | As SV1, open the Team Alpha page and the milestone again | No new milestone and no new feedback appeared from steps 2–8 (protected state unchanged) |

#### 2.1 Console commands for UAT-05 step 8

Replace `<teamId>` and `<submissionId>`. The submission ID is not shown on screen; use `1` if you do not
know it: a student is refused with 403 before the server looks up the submission.

```js
const t = sessionStorage.getItem('cpms_token');
const call = (url, body) => fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => console.log(url, r.status, await r.text()));
call('/api/teams/<teamId>/milestones', { title: 'UAT05 student attempt', deadline: '2030-01-01T00:00:00Z' });
call('/api/submissions/<submissionId>/feedback', { comment: 'UAT05 student attempt' });
```

### UAT-06 State, history and persistence

- **References:** BR-06, BR-09, FR-03, FR-13, FR-14, FR-16, FR-17; AC-01-06, AC-03-02, AC-03-05, AC-04-02, AC-04-06, AC-04-07
- **Purpose:** feedback stays attached to the version it was written for after a new version is submitted, versions are kept in order, and everything is still there after logging out and in again.
- **Roles/accounts:** S1, S2, SV1
- **Preconditions:** run **after UAT-01**, on the UAT-01 milestone (version 1 with one feedback entry). If UAT-01 failed, create a new milestone and repeat UAT-01 steps 3–8 first.
- **Inputs:** submission title `Revised report`, link `https://example.com/uat01-v2`; second feedback `Version 1 reviewed again.`

| Step | Action | Expected result |
|---|---|---|
| 1 | As **S2**, open the UAT-01 milestone and submit `Revised report` | "Version 2: Revised report", "Submitted by: Student Two"; version 1 is still listed above it with its original title and link |
| 2 | Look at the Feedback part of both versions | Version 1 still has "Good start. Add the test plan." by Supervisor One; version 2 shows "No feedback yet." |
| 3 | As SV1, open the milestone and add the second feedback to **version 1** | Version 1 lists both comments, oldest first; version 2 still has none |
| 4 | SV1 and S2: click **Log out** | Both windows return to the Sign In page |
| 5 | Close the browser completely, open it again, log in as S1 and open the milestone | Version 1 (Draft report, Student One) and version 2 (Revised report, Student Two) in this order; version 1 has both feedback entries with author and ICT time; version 2 has none |

### UAT-07 Authentication: wrong password, logout and session end

- **References:** FR-01, FR-02, FR-03, FR-04, NFR-02, NFR-04; AC-01-02, AC-01-06, AC-01-11
- **Purpose:** wrong credentials are refused without revealing which part was wrong; logout ends the session in the UI and on the server.
- **Roles/accounts:** S1
- **Preconditions:** logged out.
- **Inputs:** email `student1@cpms.test` with password `wrong-password-123`; email `nobody@cpms.test` with any password; then the real S1 password

| Step | Action | Expected result |
|---|---|---|
| 1 | On Sign In, enter S1's email and `wrong-password-123`, click **Log in** | Message "Invalid email or password"; you stay on Sign In |
| 2 | Enter `nobody@cpms.test` and any password | The same message "Invalid email or password" (it does not say whether the email exists) |
| 3 | Type the address `/student` without logging in | You are sent to the Sign In page |
| 4 | Log in with the real S1 password | Student Dashboard at `/student`, header shows "Student One", badge **Student** and **Log out** |
| 5 | Optional server check: in the Console run `window.oldToken = sessionStorage.getItem('cpms_token')` | – |
| 6 | Click **Log out** | Sign In page |
| 7 | Press the browser Back button, or type `/student` | You stay on (or return to) the Sign In page; no team data is shown |
| 8 | Optional server check: in the Console (same tab) run `fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + window.oldToken } }).then(async r => console.log(r.status, await r.text()))` | Status **401** and `UNAUTHENTICATED`: the old token was revoked by logout |

## 3. Coverage of the Sprint 1 acceptance criteria

| AC | UAT case(s) | AC | UAT case(s) |
|---|---|---|---|
| AC-01-01 login | UAT-01, UAT-07 | AC-03-01 submit v1 | UAT-01 |
| AC-01-02 wrong credentials | UAT-07 | AC-03-02 resubmit, v1 unchanged | UAT-02, UAT-06 |
| AC-01-04 current user | UAT-07 (header) | AC-03-03 4th version refused | UAT-02 |
| AC-01-06 logout revokes token | UAT-06, UAT-07 | AC-03-04 days late | UAT-01 (on time), UAT-03 |
| AC-01-07 student on supervisor operation | UAT-05 | AC-03-05 versions in order | UAT-02, UAT-06 |
| AC-01-11 role home, logout to login | UAT-01, UAT-07 | AC-03-06 supervisor lists submissions | UAT-01, UAT-03 |
| AC-02-01 student sees own team | UAT-01 | AC-03-07 other team / supervisor: not found | UAT-05 |
| AC-02-02 supervisor sees assigned teams | UAT-01, UAT-05 | AC-03-09 submission validation | UAT-04 |
| AC-02-03 team out of scope: not found | UAT-05 | AC-03-12 student milestone page | UAT-01–UAT-04 |
| AC-02-05 create milestone | UAT-01 | AC-03-13 supervisor milestone page | UAT-01 |
| AC-02-06 unassigned supervisor cannot create | UAT-05 (no form, team not found) | AC-04-01 add feedback | UAT-01 |
| AC-02-07 student cannot create milestone | UAT-05 | AC-04-02 several feedback entries | UAT-06 |
| AC-02-08 milestone validation | UAT-03, UAT-04 | AC-04-03 student cannot add feedback | UAT-05 |
| AC-02-09 milestones by deadline | UAT-01 (list) | AC-04-04 unassigned supervisor: not found | UAT-05 |
| AC-02-10 milestone detail scope | UAT-05 | AC-04-06 feedback stays on its version | UAT-06 |
| AC-02-11 student dashboard | UAT-01 | AC-04-07 feedback in lists | UAT-01, UAT-06 |
| AC-02-12 supervisor form and errors | UAT-01, UAT-04 | AC-04-10 / AC-04-11 feedback UI | UAT-01, UAT-05 |

Not covered by manual UAT, because they cannot be observed through the user interface; they are covered
by the automated tests listed in each Sprint 1 contract: AC-01-03 (missing fields in the API request),
AC-01-05 (expired/malformed token), AC-01-08 (bcrypt hash), AC-01-09 (database unique constraints),
AC-01-10 (seed is idempotent; known limitation, no test ID yet), AC-02-04 / AC-03-10 / AC-04-08 (calls
without a token), AC-03-08 (supervisor calling the submission API), AC-03-11 (10 concurrent submissions),
AC-04-05 (5000/5001-character feedback), AC-04-09 (no edit/delete endpoint for feedback).
