import { describe, it, expect } from "vitest";
import { validateMilestoneUpdate } from "../../src/utils/validation.js";
import { HttpError } from "../../src/utils/httpError.js";

function detailsOf(input: unknown): Record<string, string> | undefined {
  try {
    validateMilestoneUpdate(input);
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
    return (err as HttpError).details;
  }
}

describe("TEST-05-08: validateMilestoneUpdate boundaries (BR-04 fields, partial update)", () => {
  it("accepts a 120-character title and rejects 121 characters", () => {
    expect(detailsOf({ title: "a".repeat(120) })).toBeUndefined();
    expect(detailsOf({ title: "a".repeat(121) })).toEqual({ title: "TOO_LONG" });
  });

  it("rejects a blank title after trimming and trims a valid one", () => {
    expect(detailsOf({ title: "  " })).toEqual({ title: "REQUIRED" });
    expect(validateMilestoneUpdate({ title: "  Review  " })).toEqual({ title: "Review" });
  });

  it("clears the description with an empty string or null and rejects 2001 characters", () => {
    expect(validateMilestoneUpdate({ description: "" })).toEqual({ description: null });
    expect(validateMilestoneUpdate({ description: null })).toEqual({ description: null });
    expect(detailsOf({ description: "d".repeat(2001) })).toEqual({ description: "TOO_LONG" });
  });

  it("parses a valid deadline and rejects an invalid one; a past deadline is allowed here", () => {
    expect(validateMilestoneUpdate({ deadline: "2020-01-01T00:00:00.000Z" })).toEqual({
      deadline: new Date("2020-01-01T00:00:00.000Z"),
    });
    expect(detailsOf({ deadline: "tomorrow" })).toEqual({ deadline: "INVALID_DATE" });
  });

  it("rejects wrong types and an empty body", () => {
    expect(detailsOf({ title: 1, description: 2, deadline: 3 })).toEqual({
      title: "INVALID_TYPE",
      description: "INVALID_TYPE",
      deadline: "INVALID_TYPE",
    });
    expect(detailsOf({})).toEqual({ body: "NO_CHANGES" });
    expect(detailsOf(null)).toEqual({ body: "NO_CHANGES" });
  });
});
