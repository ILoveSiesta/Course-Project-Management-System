import { describe, it, expect } from "vitest";
import * as validation from "../../src/utils/validation.js";

// F-09 (contract docs/sprints/sprint-2/F-09-milestone-status.md). Looked up from the module object so that
// this file still type-checks before the helper exists; at RED this test fails at run time.
const deriveMilestoneStatus = (validation as Record<string, unknown>).deriveMilestoneStatus as (input: {
  deadline: Date;
  now: Date;
  latestSubmission: { daysLate: number; feedbackCount: number } | null;
}) => "Not submitted" | "Overdue" | "Submitted" | "Submitted late" | "Reviewed";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("F-09 deriveMilestoneStatus Unit Tests", () => {
  it("TEST-09-06: derives all 5 statuses in precedence order across exact boundaries and CHG-03 / BR-13 rules", () => {
    const deadline = new Date("2026-11-25T12:00:00.000Z");

    // 5. Not submitted: no submission and now <= deadline (including exact deadline)
    expect(
      deriveMilestoneStatus({ deadline, now: new Date(deadline.getTime() - HOUR), latestSubmission: null })
    ).toBe("Not submitted");
    expect(deriveMilestoneStatus({ deadline, now: deadline, latestSubmission: null })).toBe("Not submitted");

    // 4. Overdue: no submission and now > deadline (1 ms past, inside 7d window, and > 7d CHG-03 closed window)
    expect(
      deriveMilestoneStatus({ deadline, now: new Date(deadline.getTime() + 1), latestSubmission: null })
    ).toBe("Overdue");
    expect(
      deriveMilestoneStatus({ deadline, now: new Date(deadline.getTime() + 2 * DAY), latestSubmission: null })
    ).toBe("Overdue");
    expect(
      deriveMilestoneStatus({ deadline, now: new Date(deadline.getTime() + 10 * DAY), latestSubmission: null })
    ).toBe("Overdue");

    // 3. Submitted & 2. Submitted late: latest has no feedback
    expect(
      deriveMilestoneStatus({
        deadline,
        now: new Date(deadline.getTime() + 10 * DAY),
        latestSubmission: { daysLate: 0, feedbackCount: 0 },
      })
    ).toBe("Submitted");
    expect(
      deriveMilestoneStatus({
        deadline,
        now: new Date(deadline.getTime() + 10 * DAY),
        latestSubmission: { daysLate: 1, feedbackCount: 0 },
      })
    ).toBe("Submitted late");

    // 1. Reviewed: latest has >= 1 feedback (wins over daysLate > 0 and now > deadline)
    expect(
      deriveMilestoneStatus({
        deadline,
        now: new Date(deadline.getTime() + 10 * DAY),
        latestSubmission: { daysLate: 0, feedbackCount: 1 },
      })
    ).toBe("Reviewed");
    expect(
      deriveMilestoneStatus({
        deadline,
        now: new Date(deadline.getTime() + 10 * DAY),
        latestSubmission: { daysLate: 3, feedbackCount: 2 },
      })
    ).toBe("Reviewed");

    // BR-13 deadline extension effects (no submission): future -> Not submitted; past inside 7d -> Overdue
    const now = new Date("2026-12-05T12:00:00.000Z");
    expect(
      deriveMilestoneStatus({
        deadline: new Date(now.getTime() + 2 * DAY),
        now,
        latestSubmission: null,
      })
    ).toBe("Not submitted");
    expect(
      deriveMilestoneStatus({
        deadline: new Date(now.getTime() - 23 * HOUR),
        now,
        latestSubmission: null,
      })
    ).toBe("Overdue");
  });
});
