import { describe, it, expect } from "vitest";
import * as validation from "../../src/utils/validation.js";
import { HttpError } from "../../src/utils/httpError.js";

// F-06 (contract docs/sprints/sprint-2/F-06-multi-team-milestone.md). Looked up from the module object so that
// this file still type-checks before the helper exists; at RED the test fails at run time.
const validateTeamIds = (validation as Record<string, unknown>).validateTeamIds as (body: unknown) => number[];

function detailsOf(body: unknown): Record<string, string> | undefined {
  try {
    validateTeamIds(body);
    return undefined;
  } catch (err) {
    if (err instanceof HttpError) return err.details;
    throw err;
  }
}

describe("F-06 validateTeamIds", () => {
  it("TEST-06-06: accepts 1 to 20 distinct positive integers and rejects everything else", () => {
    expect(validateTeamIds({ teamIds: [1] })).toEqual([1]);
    const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(validateTeamIds({ teamIds: twenty })).toEqual(twenty);

    expect(detailsOf({ teamIds: [...twenty, 21] })).toEqual({ teamIds: "TOO_MANY" });
    expect(detailsOf({ teamIds: [] })).toEqual({ teamIds: "REQUIRED" });
    expect(detailsOf({})).toEqual({ teamIds: "REQUIRED" });
    expect(detailsOf({ teamIds: null })).toEqual({ teamIds: "REQUIRED" });
    expect(detailsOf({ teamIds: [1, 1] })).toEqual({ teamIds: "DUPLICATE" });
    for (const bad of [[0], [-1], [1.5], ["1"], "1"]) {
      expect(detailsOf({ teamIds: bad })).toEqual({ teamIds: "INVALID_TYPE" });
    }
  });
});
