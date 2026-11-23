# Change and Defect Register

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | 2026-11-23 | ILoveSiesta | First register for the release candidate `v0.3.0` (#107): Sprint 1 baseline, approved baseline changes and every deployment, UAT, maintenance and review finding up to `sprint-3` @ `f0041ff` |

This register covers the deployment (Lab 5), UAT (Lab 6), maintenance (Lab 7) and review/audit findings. It
records the decision and the status of each finding: resolved or remaining, the release that contains the fix
or change, and the re-test outcome. Issues, triage comments, RED → GREEN commits and reviews are on GitHub
under the IDs given. Contract and test details are in `docs/sprints/` and `docs/traceability.md`.

## 1. Accepted Sprint 1 baseline

| Item | Value |
|---|---|
| Sprint 1 release (Deliverable 1) | `v0.1.0` = `25211ac` (6 Nov 2026) |
| Accepted Sprint 1 release (Lab 6) | `v0.1.2` = `9dd9239`, Deploy demo run 44744094900, Cloud Run revision `cpms-00008-qwd`; accepted without conditions by the partner team (YourMoneyOurMoney) on 2026-11-20 |
| Current release on `main` | `v0.2.0` = `7c3a970` (Sprint 2), Deploy demo run 44915248527, revision `cpms-00009-w5t` |
| Release candidate | `v0.3.0` from `sprint-3` (#107 preparation, #85 release) |
| Original critical journey | Supervisor creates a milestone → student submits → supervisor records feedback → student sees it (TEST-E2E-01, `e2e/sprint1-normal-journey.spec.ts`); rejection journey TEST-E2E-02 (4th version rejected). Both run in `npm run test:e2e` on every release candidate |

## 2. Approved baseline changes

| ID | Date | Affected requirement / feature | Change | Rationale | Approved by | Release | Status |
|---|---|---|---|---|---|---|---|
| CHG-01 | 2026-11-05 | SDS §3.2; UI of F-01, F-02; SR-06 | Shared stylesheet `client/src/theme.css`; no inline styles | Consistent UI across features (the TA asked for the shared style in Sprint 1) | ILoveSiesta (proposed); phet526 confirmed in the PR #9 review | `v0.1.0` | In force |
| CHG-02 | 2026-11-12 | SDS §7–§8; SR-03, NFR-08, NFR-09 | Migration/seed as a separate Cloud Run job; deploy on merge into `main` without manual approval; `/api/ready`; seed password from the environment | Course starter kit (Lab 5) | ILoveSiesta (proposed in #18); phet526 confirmed in the #18 PR review | `v0.1.1` | In force |
| CHG-03 | 2026-11-21 | BR-05, D-01, FR-12; F-03 contract v0.2 | Late submissions accepted for at most 7 × 24 h after the deadline; later ones `409 SUBMISSION_WINDOW_CLOSED` | Lab 7 maintenance change request #59 | TA Kantapat Suwannahong, 2026-11-21 13:20 ICT | `v0.2.0` | In force; re-checked on each release |

## 3. Findings

Status values:
- **Resolved:** the fix is merged and released, and the re-test passed.
- **Fixed, release pending:** the fix is merged into `sprint-3` and will be released in `v0.3.0`; the re-test on the deployed release is planned in #85.
- **Not a defect:** no code change was needed.
- **Open:** not fixed yet.

| ID | Source | Affected requirement / feature | Decision (severity) | Fix / change (PR → merge commit) | Release | Re-test outcome | Status |
|---|---|---|---|---|---|---|---|
| LAB5-01 | Lab 5 deployment (release 1, #21) | NFR-09, SR-03 (release identification) | Accepted. The Deploy demo summary showed the digest of an image index (provenance attestation), not of the manifest that Cloud Run serves | PR #43: single-manifest build (`--provenance=false --sbom=false`) | `v0.1.1` (`53003a5`, run 43470205241, `cpms-00003-xkm`) | Release 2: one digest (`a1389661…`) in the run summary and the Cloud Run revision (`docs/labs/lab-05/deployment.md` v0.7, §6.4) | Resolved |
| #52 | Lab 6 UAT (partner team) | UAT-06 case text; BR-07 | Not a defect: the case reused the UAT-01 milestone, which had reached the 3-version limit | PR #53 → `a6d6526`: `uat-plan.md` v0.3 | `v0.1.2` (documents) | Manual re-test of UAT-06 v0.3 by the partner: PASS (2026-11-20) | Not a defect (closed) |
| #54 | Lab 6 UAT (partner team) | F-02/F-03 UI; NFR-11 | Accepted defect (Minor): long unbroken titles overflowed the card | PR #55 → `54c0717` (RED `044ea2a` → GREEN `d4590dc`) | `v0.1.2` (`9dd9239`) | Partner re-test of UAT-04 on `v0.1.2`: PASS | Resolved |
| #59 | Lab 7 change request | BR-05 / CHG-03; F-03 | Approved change | PR #71 → `c82a867` (contract), PR #72 → `feaafdb` (RED `f5deaf7` → GREEN `8259688`) | `v0.2.0` | Post-deployment on `cpms-00009-w5t`: up to 7 days late accepted (`Late (+3 d)`), more than 7 days → `409 SUBMISSION_WINDOW_CLOSED` with nothing stored (milestone 22), preserved Sprint 1 path PASS (#59 comments 7065262659, 7065624902, 7065804018). Re-check on `v0.3.0` planned in #85 | Resolved |
| AC-01-10 (#65) | Deliverable 1 known limitation | BR-10 seed; F-01 | Accepted: missing automated test for the idempotent seed | PR #74 → `022acea` (TEST-01-14; test only, behaviour already correct) | `v0.2.0` | TEST-01-14 PASS in the `v0.2.0` regression | Resolved |
| #89 | Review of PR #88 (F-13) | F-06, NFR-05 | Accepted defect (Minor): team IDs above INT4 returned 500 instead of 404 | PR #98 → `9b05789` (RED `d76a7dc` → GREEN `09a5408`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |
| #90 | Review of PR #88 (F-13) | NFR-05, NFR-12; F-01..F-06, F-13 | Accepted defect (Medium): malformed requests, NUL / unpaired surrogates and years ≥ 10000 returned 500; a malformed login body was written to the log with the password | PR #91 → `9aebc93` | `v0.3.0` | Planned on `v0.3.0` (#85), including a check that the server log has no password | Fixed, release pending |
| #92 | Whole-system audit 2026-11-22 | F-01, NFR-02, NFR-04, NFR-05 | Accepted defect: a DB failure was reported as 401 (Major); logout race, login timing, password in log, static-file 4xx returned as 500 (Minor) | PR #99 → `77ef742` (pre-fix RED on `9b05789` src, GREEN `9eabab2`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |
| #93 | Whole-system audit 2026-11-22 | F-08, BR-11 | Accepted defect (Major): **Release grade** ignored unsaved changes and released the old grade | PR #97 → `1c92061` (RED `6cd2e11` → GREEN `f5a0912`; round 2 RED `25b0e18` → GREEN `36d0d99`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |
| #94 DEF-DEADLINE | Whole-system audit 2026-11-22 | BR-04; F-02, F-05, F-06 | Accepted defect (Minor): impossible or non-ISO deadlines were stored as another date; a five-digit year crashed the forms | PR #104 → `326e66a` (RED `33d0cdf` → GREEN `6eeb7c5`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |
| #94 DEF-CLIENT-SESSION | Whole-system audit 2026-11-22 | FR-02, FR-03, FR-07, NFR-12; F-01, F-13 | Accepted defect (Minor): the client ended the session on non-401 errors, a failed logout looked successful, and raw connection errors were shown | PR #104 → `326e66a` (RED `5e687d5` → GREEN `a0f56b6`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |
| #94 DEF-F03-CONTRACT | Whole-system audit 2026-11-22 | BR-08, FR-12; F-03 | Accepted defect (Minor): relative-looking links were accepted, the team name was missing on the student milestone page, and a documented `daysLate` check did not exist (contract corrected, no migration) | PR #104 → `326e66a` (RED `9430b8c` → GREEN `898447f`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |
| #100 | Review of PR #97 | F-08, BR-11 | Accepted defect (Major): **Release grade** published a grade that had changed after the page loaded | PR #101 → `910a424` (RED `5faff1d` → GREEN `cf7161b`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |
| #102 | Review of PR #97 | F-02, F-03, F-05, F-07, F-08, F-13 | Accepted defect (Major): after Back/Forward a page kept the previous record's state, so Save, Release, Edit and Add member could act on a record other than the one shown | PR #105 → `cef176a` (RED `70315e0` → GREEN `b1a8eff`; tests extended in `822cd03`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |
| #103 | Review of PR #97 | F-08, BR-11, NFR-11 | Accepted defect (Major): a double-click on **Save grade** at phone width could release the grade | PR #106 → `f0041ff` (RED `5342792` → GREEN `6523f7a`) | `v0.3.0` | Planned on `v0.3.0` (#85) | Fixed, release pending |

Issue numbers #95 and #96 do not exist. The two Minor findings opened under those numbers on 2026-11-22 were
merged into #94 the same day, and the two issues were deleted. #94 keeps their content as `DEF-CLIENT-SESSION`
and `DEF-F03-CONTRACT`.

## 4. Open items

No accepted defect is open at the release-candidate preparation (`sprint-3` @ `f0041ff`). The re-tests marked
"Planned on `v0.3.0`" are part of #85. Remaining Sprint 3 work and known limitations are listed in
`docs/sprints/sprint-3/README.md`.
