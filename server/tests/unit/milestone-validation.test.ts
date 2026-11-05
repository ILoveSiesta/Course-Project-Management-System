import { describe, it, expect } from "vitest";
import { validateMilestoneInput } from "../../src/utils/validation.js";
import { HttpError } from "../../src/utils/httpError.js";

const NOW = new Date("2026-11-05T10:00:00.000Z");

function detailsOf(input: unknown): Record<string, string> | undefined {
  try {
    validateMilestoneInput(input, NOW);
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    return (err as HttpError).details;
  }
}

describe("TEST-02-11: validateMilestoneInput boundaries (BR-04)", () => {
  it("accepts a 120-character title and rejects 121 characters", () => {
    expect(detailsOf({ title: "a".repeat(120), deadline: "2026-11-06T00:00:00Z" })).toBeUndefined();
    expect(detailsOf({ title: "a".repeat(121), deadline: "2026-11-06T00:00:00Z" })).toEqual({ title: "TOO_LONG" });
  });

  it("rejects a blank title after trimming", () => {
    expect(detailsOf({ title: " \t ", deadline: "2026-11-06T00:00:00Z" })).toEqual({ title: "REQUIRED" });
  });

  it("rejects a deadline equal to now and accepts one second later", () => {
    expect(detailsOf({ title: "x", deadline: NOW.toISOString() })).toEqual({ deadline: "MUST_BE_FUTURE" });
    expect(detailsOf({ title: "x", deadline: new Date(NOW.getTime() + 1000).toISOString() })).toBeUndefined();
  });

  it("normalises the accepted input", () => {
    const result = validateMilestoneInput(
      { title: "  Final report ", description: "", deadline: "2026-12-13T16:59:00Z" },
      NOW
    );
    expect(result).toEqual({
      title: "Final report",
      description: null,
      deadline: new Date("2026-12-13T16:59:00.000Z"),
    });
  });

  it("reports several invalid fields together", () => {
    expect(detailsOf({ description: 5 })).toEqual({
      title: "REQUIRED",
      description: "INVALID_TYPE",
      deadline: "REQUIRED",
    });
  });

  it("rejects a non-object body", () => {
    expect(detailsOf(null)).toEqual({ title: "REQUIRED", deadline: "REQUIRED" });
  });
});
