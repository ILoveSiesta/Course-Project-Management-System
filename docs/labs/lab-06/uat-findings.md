# Lab 6: UAT Findings and Triage (Part C)

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-20 | ILoveSiesta | Received findings #52 and #54; outgoing reports to YourMoneyOurMoney (their #59 and #60) (#56) |
| 0.2 | 2026-11-21 | ILoveSiesta | Final Lab 6 state as submitted in the Lab 6 report: retests of #52 and #54 PASS and CPMS Accepted by YMOM (§1.1); our retests of YMOM #60 and #59 PASS and our acceptance of YMOM (§2.1) (#60) |

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
| [#52](https://github.com/ILoveSiesta/Course-Project-Management-System/issues/52) UAT-06 cannot be re-run: depends on the UAT-01 milestone, which reaches the 3-version limit | Gluesaber (YMOM), 2026-11-18 22:45 | UAT-06 (preconditions, step 1); BR-07, AC-03-03 | **Not-defect.** The product behaved as specified: BR-07 allows at most 3 versions per milestone, and Sprint 1 has no delete. The problem was in our case text: v0.2 told UAT-06 to reuse the UAT-01 milestone, so a re-run or retest found it already full. The reporter suggested the same classification. | n/a | phet526 / ILoveSiesta | Case text corrected in `uat-plan.md` v0.3: UAT-06 now creates its own milestone and states the BR-07 limit. PR #53, merged 2026-11-19 23:49 (`a6d6526`). No product change, so no RED/GREEN test. Closed 2026-11-19 23:50. **Retest PASS** with UAT-06 v0.3 (Harit, §1.1) |
| [#54](https://github.com/ILoveSiesta/Course-Project-Management-System/issues/54) Milestone title and description overflow the container on long unbroken strings | ArgoJR203 (YMOM), 2026-11-19 23:27 | UAT-04 step 3; AC-02-08 (120-character title accepted), AC-02-12 (new milestone is listed) | **Accepted defect.** The system accepts a 120-character title, as specified, but on the Milestones list the text runs past the card and the page, so the listed title is not shown correctly. `theme.css` had no wrapping rule. This is wrong behaviour for an accepted Sprint 1 input, not a new feature. We had disclosed it as a dry-run note in `uat-plan.md` §1.3. | **Minor**: data is stored correctly and the user can still finish the task; the problem is display only | phet526 / ILoveSiesta | Triaged 2026-11-20 00:14. PR #55: RED `044ea2a` (Playwright `e2e/issue54-text-wrapping.spec.ts` fails: page width 2301 px > 1281 px), GREEN `d4590dc` (`theme.css` wrapping rules), merged into `sprint-1` 2026-11-20 00:23 (`54c0717`). Closed 2026-11-20 00:24. Released in `v0.1.2` (`9dd9239`, PR #58), Cloud Run revision `cpms-00008-qwd`, deployed 2026-11-20 20:24 (Deploy demo run 44744094900). **Retest PASS** on `v0.1.2` (Jirawat, §1.1) |

Notes:

- Neither finding is Critical or Major, so nothing blocks Sprint 1 acceptance. #54 is fixed rather than listed as a known limitation.
- The report templates in #52 and #54 left the tester name and deployed revision as placeholders. The reporter here is the GitHub account that opened the Issue. The tested release is the one that was deployed during the UAT sessions (no deployment happened between 2026-11-15 and the Lab 6 release).
- Before deciding, both findings were reproduced: #52 by the BR-07 message that UAT-02 also expects (passed in phet526's dry-run on the public URL and in the UAT Team's run), #54 by an automated test before the fix (E2E RED: page width 2301 px > 1281 px).
- There were no duplicate or enhancement findings, and no minor limitation for the UAT Team to accept, because #54 was fixed instead of being listed as a known limitation.

### 1.1 Retest and acceptance by the UAT Team

Sent to the UAT Team: the new version (`v0.1.2` / `9dd9239` / `cpms-00008-qwd` / footer `CPMS v0.1.2`) and the cases to retest from `uat-plan.md` v0.4 §1.2: UAT-04 step 3 (reproduction of #54) and UAT-06 v0.3 (#52).

| Retest | Tester | Time (ICT) / version | Input and actual result (as recorded by the UAT Team) | Result |
|---|---|---|---|---|
| #54: UAT-04 step 3 | Jirawat Rachatapramet (`ArgoJR203`) | 2026-11-20 ~21:00 · `v0.1.2` = `9dd9239`, `cpms-00008-qwd` | Title and description of 120 zeros with no spaces. The text wraps inside the Milestones card, does not run past the card as before, and there is no horizontal scroll bar ([comment 7041762671 in #54](https://github.com/ILoveSiesta/Course-Project-Management-System/issues/54#issuecomment-7041762671)) | **PASS** |
| #52: UAT-06 v0.3, all 7 steps | Harit Chaiyanukit (`Gluesaber`) | 2026-11-20 16:31–16:35 · `38dc25c` / `cpms-00007-k5d` (footer `CPMS v0.1.1`) | New milestone `UAT-MAI-UAT06-01` (id 17). S1 v1 at 16:31 (On time), feedback 1 on v1 at 16:31, S2 v2 at 16:32 (v1 unchanged), feedback 2 on v1 at 16:35 listed oldest first, v2 has no feedback. After logging in again as S1, the order and feedback are the same | **PASS** |

The UAT-06 v0.3 retest ran before `v0.1.2` was deployed (20:24), so it ran on `38dc25c`. The change for #52 was case text only, with no code change, and the difference from `38dc25c` to `9dd9239` is CSS (#54), the footer and documents. The case retested on `v0.1.2` itself is UAT-04, the case affected by the #54 fix.

**Final acceptance of CPMS Sprint 1 (recorded by the UAT Team):**

| Item | Value |
|---|---|
| Decision | **Accepted** |
| Accepted release | `main` @ `9dd9239` (CPMS `v0.1.2`, PR #58), Cloud Run `cpms-00008-qwd`, deployed 2026-11-20 20:24 (Deploy demo run 44744094900, smoke test PASS) |
| Scope | Sprint 1 only, as in handoff §1.3 and UAT-01..07 in `uat-plan.md`; no Sprint 2/3 features |
| Results per case | UAT-01, 02, 03, 04 (Jirawat) PASS; UAT-04 found #54. UAT-05, 07 (Harit) PASS. UAT-06 (Harit) BLOCKED on v0.2 (#52), PASS on v0.3. First round on 2026-11-18 on `38dc25c` |
| Findings | #52 UAT pack issue, retest PASS (v0.3). #54 product defect Minor, retest PASS on `v0.1.2` |
| Open defects / BLOCKED | No Critical or Major; the only Minor defect is fixed and retested; no test left BLOCKED |
| Conditions / known limitations | None |
| Signed / date | Jirawat Rachatapramet (67070501057), Harit Chaiyanukit (67070501047), team YourMoneyOurMoney, 2026-11-20 |

Source: `UAT_ACCEPTANCE_DECISION.md` and `README_UAT-01-07_results.md` sent by the UAT Team on 2026-11-20 23:18 with 19 screenshots. Deviations the UAT Team recorded themselves: UAT-01..04 used short names and inputs (for example `UAT-01`, `https://test.com`), some steps have no screenshot, UAT-05 step 8 used placeholders in the browser console, and two 503 responses at cold start were noted as observations, not defects.

## 2. Findings we reported to YourMoneyOurMoney (we are the UAT Team)

Tested release: YMOM `main` @ `a09855f` (Sprint 1 baseline `v0.1.0` / `d2be6e7`). All six agreed cases from the YMOM handoff (UAT-01 to UAT-06) passed. The two findings below come from **additional** Sprint 1 boundary cases that we ran ourselves (UAT-ADD-01 and UAT-ADD-02). They are not part of the agreed case list.

| Issue (YMOM repo) | Reporter / when | Linked case and contract | Expected vs actual | Severity | Product Team triage | Fix and our retest |
|---|---|---|---|---|---|---|
| [#60](https://github.com/Gluesaber/YourMoneyOurMoney/issues/60) Out-of-range date (outside 2000–2099) shows a generic "Invalid request." without highlighting the Date field | phet526 (CPMS), tested 2026-11-20 00:38–00:40, reported 00:49 | UAT-ADD-01; YMOM `system-sds.md` §1.4, F-03 R4 / AC-ACC-07, F-04 step 1 / AC-TX-05 | Expected: the request is rejected, the Date field is highlighted and the 2000–2099 rule is shown. Actual: the request is rejected and nothing is saved, but the page shows only "Invalid request."; the Date field is not highlighted and the range is not shown (opening balance and record payment) | **Minor**: no data is stored or changed; the user cannot tell which field failed | Accepted defect, Minor (Gluesaber, 2026-11-20 15:22) | YMOM PR #61 merged into their staging 15:58; Issue closed 15:59. YMOM release PR #63, `main` @ `0731479` deployed 16:56 (their run 44714930395). **Our retest PASS** on `0731479` (§2.1) |
| [#59](https://github.com/Gluesaber/YourMoneyOurMoney/issues/59) Long unbroken 200-character Note overflows the Transaction Detail page (desktop and 368 px) | phet526 (CPMS), tested 2026-11-20 00:42–00:43, reported 00:48 | UAT-ADD-02; YMOM F-04 §8 (note ≤ 200 characters), F-05 §5 (detail view), NFR-COMP-02 (layout from 360 px) | Expected: the full note wraps inside the detail section. Actual: the transaction is saved, but the note runs past the 640 px section and the viewport on desktop and at 368 × 629 px | **Minor**: data and balances are correct; display only | Accepted defect, Minor (ArgoJR203, 2026-11-20 16:07) | YMOM PR #62 merged into their staging 16:36; Issue closed 16:43. Deployed in the same YMOM `main` @ `0731479`. **Our retest PASS** on `0731479` (§2.1) |

Evidence for both reports: screenshots with capture times in the Issues and in the Lab 6 report (Part B, additional cases).

### 2.1 Our retest and our acceptance of YMOM

YMOM fixed #60 and #59 and released them as `main` @ `0731479` (YMOM PR #63, deployed 2026-11-20 16:56 by their Deploy demo run 44714930395). ILoveSiesta retested by hand on https://ymom-ck76twbqbq-as.a.run.app with the `alice` account, using the same inputs as in the Issues. The results are recorded as comments in [YMOM #60](https://github.com/Gluesaber/YourMoneyOurMoney/issues/60#issuecomment-7042107571) and [YMOM #59](https://github.com/Gluesaber/YourMoneyOurMoney/issues/59#issuecomment-7042107986).

| Step | Action (same input as in the Issue) | Actual result | Result |
|---|---|---|---|
| R0 | Open Deploy demo run 44714930395 | Push of `0731479` on `main` succeeded (confirms the retested version) | — |
| R1 | Open `/dashboard` before testing | Bank 92,979.99 · Credit Card 0.00 · Total expense 7,520.01 · Dining 2,700.01 | — |
| R2 | #60: Opening balance Bank, 2,220.00, Date `1999-12-31`, Save | The Date field has a red border and a warning icon; "Use a date from 2000 to 2099." is shown under it | **PASS** |
| R3 | #60: Opening balance Bank, 10,000.00, Date `1999-12-31`, Save | Date field red border, same message | **PASS** |
| R4 | #60: Record payment Bank, Date `1999-12-31`, Total 10, Dining 10, Save | Date field red border; "Use a date from 2000 to 2099." under it | **PASS** |
| R5 | #60: Cancel, then open `/dashboard` and History | All numbers match R1; History has no new entry and the top entry is still tx 18 (0.01): nothing was saved | **PASS** |
| R6 | #59: Open `/transactions/18` on desktop (the transaction from the Issue) | The note wraps inside the detail column (as wide as the 640 px table), does not run past the right edge, no horizontal scroll bar | **PASS** |
| R7 | #59: Same transaction in DevTools Responsive 368 × 629 px | The note wraps within the screen width, no horizontal overflow | **PASS** |

Notes from the comments: the "Invalid request." box above the form is still shown, but the user can now see that the Date field is wrong and the allowed range, which matches YMOM `system-sds.md` §1.4. The Credit Card opening balance form was not retested in this round; it uses the same `OpeningBalancePage` as the Bank form, which passed.

**Our acceptance of YMOM Sprint 1:**

| Item | Value |
|---|---|
| Decision | **Accepted** |
| Accepted release | YMOM `main` @ `0731479` (`0731479b5c02f1e304f1f469cd0c3ef1631c655c`), deployed 2026-11-20 16:56 (Deploy demo run 44714930395) |
| Scope | Sprint 1 only, as in UAT-01..06 from their handoff; no Sprint 2/3 features |
| Basis | UAT-01..06 PASS 6/6 on `a09855f` (2026-11-18); our 2 additional boundary cases found Minor defects #60 and #59; YMOM fixed them; retest PASS for both on `0731479` (2026-11-20 20:54–21:05) |
| Open defects / BLOCKED | No Critical or Major; both Minor defects fixed and retested; no test BLOCKED |
| Conditions / known limitations | None |
| Testers / date | นายวัทธิกร ศรีประดับทอง (`ILoveSiesta`, 67070501073), นายพชร มัสมี (`phet526`, 67070501066), team CPMS, 2026-11-20. Sent to YMOM as `UAT_ACCEPTANCE_DECISION.md` in the evidence package `ymom-uat-01-06-CPMS.zip` |
