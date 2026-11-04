# F-XX <Feature name> — Engineering Contract

> Commit this contract as the **first** commit of the feature branch (`docs(F-XX): contract`), then the failing
> tests (`test(F-XX): ...`), then the implementation (`feat(F-XX): ...`). Revise it with a new version row
> rather than rewriting history. After merge, add the AC and test IDs to `docs/traceability.md`.

| Version | Date | Author(s) | Change |
|---|---|---|---|
| 0.1 | | | Initial contract |

## 1. Linked requirements

FR: · BR: · NFR:

## 2. Feature-level design

- Behavior and workflow:
- Business rules and validation:
- Failure and boundary cases:
- Permissions (who may do what, on which records):
- Dependencies:

## 3. UI specification

<!-- Screens, states (loading/empty/error), validation messages. Or: "No UI change." -->

## 4. API specification

| Method | Path | Auth / role | Request | Success response | Errors |
|---|---|---|---|---|---|

## 5. Data specification

<!-- Fields, constraints, migration name. Or: "No schema change." -->

## 6. Acceptance criteria

| AC ID | Given / When / Then |
|---|---|
| AC-XX-01 | |

## 7. Software Test Specification (STS)

| Test ID | AC | Level (unit/API/UI/E2E) | Precondition / input | Action | Expected result | File / test name |
|---|---|---|---|---|---|---|
| TEST-XX-01 | | | | | | |

## 8. Definition of Done and evidence

- [ ] All AC implemented
- [ ] All STS tests executed and passing (command, commit, counts recorded)
- [ ] TDD red → green evidence for rule work (commits:)
- [ ] PR reviewed by teammate and merged into sprint staging (PR #)
- [ ] Docs updated
