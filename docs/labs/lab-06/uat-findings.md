# Lab 6: UAT Findings and Triage (Part C)

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-20 | ILoveSiesta | Received findings #52 and #54; outgoing reports to YourMoneyOurMoney (their #59 and #60) (#56) |

This document records every Lab 6 UAT finding, as handout §3.3 (Part C) asks:

- the findings we **received** about our own Sprint 1 product, with classification, reason, severity, owner, fix status and disposition;
- the findings we **reported** while acting as the UAT Team for the other team's product.

The full reports, triage comments and review text are in the linked GitHub Issues and PRs. All times are ICT (UTC+7).

| Role | Team | Students |
|---|---|---|
| Product Team (our product) | CPMS, theme 6 Course Project Management System | ILoveSiesta, phet526 |
| UAT Team for our product | YourMoneyOurMoney (YMOM), theme 7 Personal Finance | Harit Chaiyanukit (`Gluesaber`), Jirawat Rachatapramet (`ArgoJR203`) |

Severity scale (from `uat-plan.md` §1.6): **Critical** = security/data problem or main journey impossible; **Major** = a Sprint 1 rule or main journey step gives a wrong result with no reasonable workaround; **Minor** = wrong or unclear message, display or formatting problem, but the user can still finish the task.

## 1. Findings received about CPMS (we are the Product Team)

Tested release: `main` @ `38dc25c`, Cloud Run revision `cpms-00007-k5d`, footer `CPMS v0.1.1` (`uat-plan.md` §1.2).

| Issue | Reported by / when | Linked case and contract | Classification and reason | Severity | Owner / reviewer | Fix and status |
|---|---|---|---|---|---|---|
| [#52](https://github.com/ILoveSiesta/Course-Project-Management-System/issues/52) UAT-06 cannot be re-run: depends on the UAT-01 milestone, which reaches the 3-version limit | Gluesaber (YMOM), 2026-11-18 22:45 | UAT-06 (preconditions, step 1); BR-07, AC-03-03 | **Not-defect.** The product behaved as specified: BR-07 allows at most 3 versions per milestone, and Sprint 1 has no delete. The problem was in our case text: v0.2 told UAT-06 to reuse the UAT-01 milestone, so a re-run or retest found it already full. The reporter suggested the same classification. | n/a | phet526 / ILoveSiesta | Case text corrected in `uat-plan.md` v0.3: UAT-06 now creates its own milestone and states the BR-07 limit. PR #53, merged 2026-11-19 23:49 (`a6d6526`). No product change, so no RED/GREEN test. Closed 2026-11-19 23:50 |
| [#54](https://github.com/ILoveSiesta/Course-Project-Management-System/issues/54) Milestone title and description overflow the container on long unbroken strings | ArgoJR203 (YMOM), 2026-11-19 23:27 | UAT-04 step 3; AC-02-08 (120-character title accepted), AC-02-12 (new milestone is listed) | **Accepted defect.** The system accepts a 120-character title, as specified, but on the Milestones list the text runs past the card and the page, so the listed title is not shown correctly. `theme.css` had no wrapping rule. This is wrong behaviour for an accepted Sprint 1 input, not a new feature. We had disclosed it as a dry-run note in `uat-plan.md` §1.3. | **Minor**: data is stored correctly and the user can still finish the task; the problem is display only | phet526 / ILoveSiesta | Triaged 2026-11-20 00:14. PR #55: RED `044ea2a` (Playwright `e2e/issue54-text-wrapping.spec.ts` fails: page width 2301 px > 1281 px), GREEN `d4590dc` (`theme.css` wrapping rules), merged into `sprint-1` 2026-11-20 00:23 (`54c0717`). Closed 2026-11-20 00:24. **To be deployed in `v0.1.2`; UAT Team retest pending** |

Notes:

- Neither finding is Critical or Major, so nothing blocks Sprint 1 acceptance. #54 is fixed rather than listed as a known limitation.
- The report templates in #52 and #54 left the tester name and deployed revision as placeholders. The reporter here is the GitHub account that opened the Issue. The tested release is the one that was deployed during the UAT sessions (no deployment happened between 2026-11-15 and the Lab 6 release).
- The retest result and the UAT Team's final acceptance decision will be recorded in the Issues and the Lab 6 report, with tester names, version and date. Only the UAT Team can give that decision.

## 2. Findings we reported to YourMoneyOurMoney (we are the UAT Team)

Tested release: YMOM `main` @ `a09855f` (Sprint 1 baseline `v0.1.0` / `d2be6e7`). All six agreed cases from the YMOM handoff (UAT-01 to UAT-06) passed. The two findings below come from **additional** Sprint 1 boundary cases that we ran ourselves (UAT-ADD-01 and UAT-ADD-02). They are not part of the agreed case list.

| Issue (YMOM repo) | Reporter / when | Linked case and contract | Expected vs actual | Severity | Product Team triage | Fix and our retest |
|---|---|---|---|---|---|---|
| [#60](https://github.com/Gluesaber/YourMoneyOurMoney/issues/60) Out-of-range date (outside 2000–2099) shows a generic "Invalid request." without highlighting the Date field | phet526 (CPMS), tested 2026-11-20 00:38–00:40, reported 00:49 | UAT-ADD-01; YMOM `system-sds.md` §1.4, F-03 R4 / AC-ACC-07, F-04 step 1 / AC-TX-05 | Expected: the request is rejected, the Date field is highlighted and the 2000–2099 rule is shown. Actual: the request is rejected and nothing is saved, but the page shows only "Invalid request."; the Date field is not highlighted and the range is not shown (opening balance and record payment) | **Minor**: no data is stored or changed; the user cannot tell which field failed | Accepted defect, Minor (Gluesaber, 2026-11-20 15:22) | YMOM PR #61 merged into their staging 15:58; Issue closed 15:59. YMOM `main` @ `0731479` deployed 16:56 (their run 44714930395). **Our retest pending** |
| [#59](https://github.com/Gluesaber/YourMoneyOurMoney/issues/59) Long unbroken 200-character Note overflows the Transaction Detail page (desktop and 368 px) | phet526 (CPMS), tested 2026-11-20 00:42–00:43, reported 00:48 | UAT-ADD-02; YMOM F-04 §8 (note ≤ 200 characters), F-05 §5 (detail view), NFR-COMP-02 (layout from 360 px) | Expected: the full note wraps inside the detail section. Actual: the transaction is saved, but the note runs past the 640 px section and the viewport on desktop and at 368 × 629 px | **Minor**: data and balances are correct; display only | Accepted defect, Minor (ArgoJR203, 2026-11-20 16:07) | YMOM PR #62 merged into their staging 16:36; Issue closed 16:43. Deployed in the same YMOM `main` @ `0731479`. **Our retest pending** |

Evidence for both reports: screenshots with capture times in the Issues and in the Lab 6 report (Part B, additional cases).

Before we retest on YMOM `0731479`, we will confirm which Sprint 1 scope and contract that release covers. It was merged from their Sprint 2 staging branch, and handout §2 accepts a newer deployment only when the tested Sprint 1 scope is clearly identified. We will then record our final decision for their Sprint 1 release (Accepted / Accepted with minor limitations / Not Accepted) with tester names, version and date.
