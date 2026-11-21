import { describe, it, expect } from "vitest";
import * as submissionRules from "../../src/utils/submissionValidation.js";
import { HttpError } from "../../src/utils/httpError.js";

// F-07 (contract docs/sprints/sprint-2/F-07-revision-history.md). Looked up from the module object so that
// this file still type-checks before the helpers exist; at RED this test fails at run time.
const parseHistoryOrder = (submissionRules as Record<string, unknown>).parseHistoryOrder as (
  raw: unknown
) => "desc" | "asc";
const buildRevisionHistory = (submissionRules as Record<string, unknown>).buildRevisionHistory as (
  milestone: {
    id: number;
    teamId: number;
    teamName: string;
    title: string;
    description: string | null;
    deadline: string;
  },
  submissions: Array<{
    id: number;
    milestoneId: number;
    version: number;
    title: string;
    description: string | null;
    link: string;
    submittedAt: string;
    daysLate: number;
    submittedBy: { id: number; name: string };
    feedback: Array<{
      id: number;
      submissionId: number;
      comment: string;
      createdAt: string;
      author: { id: number; name: string };
    }>;
  }>,
  order: "desc" | "asc"
) => {
  milestone: { id: number; teamId: number; teamName: string; title: string; description: string | null; deadline: string };
  totalVersions: number;
  latestVersion: number | null;
  revisions: Array<Record<string, unknown>>;
};

describe("F-07 Revision History Unit Tests", () => {
  it("TEST-07-06: parses sort order and builds revision metadata for 0, 1, and multiple versions", () => {
    expect(parseHistoryOrder(undefined)).toBe("desc");
    expect(parseHistoryOrder("desc")).toBe("desc");
    expect(parseHistoryOrder("asc")).toBe("asc");

    for (const bad of ["", "ASC", "latest", 123]) {
      try {
        parseHistoryOrder(bad);
        expect.unreachable(`Expected parseHistoryOrder(${JSON.stringify(bad)}) to throw`);
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(400);
        expect((err as HttpError).code).toBe("VALIDATION_ERROR");
        expect((err as HttpError).details).toEqual({ order: "INVALID_ORDER" });
      }
    }

    const milestone = {
      id: 10,
      teamId: 1,
      teamName: "Team Alpha",
      title: "SRS draft",
      description: null,
      deadline: "2026-11-08T16:59:00.000Z",
    };

    expect(buildRevisionHistory(milestone, [], "desc")).toEqual({
      milestone,
      totalVersions: 0,
      latestVersion: null,
      revisions: [],
    });

    const v1 = {
      id: 101,
      milestoneId: 10,
      version: 1,
      title: "v1",
      description: "First",
      link: "https://example.com/v1",
      submittedAt: "2026-11-08T10:00:00.000Z",
      daysLate: 0,
      submittedBy: { id: 1, name: "Student One" },
      feedback: [
        {
          id: 201,
          submissionId: 101,
          comment: "Good start",
          createdAt: "2026-11-08T12:00:00.000Z",
          author: { id: 7, name: "Supervisor One" },
        },
      ],
    };
    const v2 = {
      id: 102,
      milestoneId: 10,
      version: 2,
      title: "v2",
      description: null,
      link: "https://example.com/v2",
      submittedAt: "2026-11-09T10:00:00.000Z",
      daysLate: 1,
      submittedBy: { id: 2, name: "Student Two" },
      feedback: [],
    };

    const single = buildRevisionHistory(milestone, [v1], "desc");
    expect(single.totalVersions).toBe(1);
    expect(single.latestVersion).toBe(1);
    expect(single.revisions[0]).toMatchObject({
      version: 1,
      isLatest: true,
      isLate: false,
      feedbackCount: 1,
    });

    const descHistory = buildRevisionHistory(milestone, [v1, v2], "desc");
    expect(descHistory.totalVersions).toBe(2);
    expect(descHistory.latestVersion).toBe(2);
    expect(descHistory.revisions.map((r) => r.version)).toEqual([2, 1]);
    expect(descHistory.revisions[0]).toMatchObject({ version: 2, isLatest: true, isLate: true, feedbackCount: 0 });
    expect(descHistory.revisions[1]).toMatchObject({ version: 1, isLatest: false, isLate: false, feedbackCount: 1 });

    const ascHistory = buildRevisionHistory(milestone, [v1, v2], "asc");
    expect(ascHistory.revisions.map((r) => r.version)).toEqual([1, 2]);
  });
});
