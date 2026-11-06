import { describe, it, expect } from "vitest";
import { validateFeedbackInput } from "../../src/utils/feedbackValidation.js";
import { HttpError } from "../../src/utils/httpError.js";

function detailsOf(input: unknown): Record<string, string> | undefined {
  try {
    validateFeedbackInput(input);
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    return (err as HttpError).details;
  }
}

describe("TEST-04-10: validateFeedbackInput boundaries (BR-09)", () => {
  it("accepts 5000 characters and rejects 5001", () => {
    expect(detailsOf({ comment: "a".repeat(5000) })).toBeUndefined();
    expect(detailsOf({ comment: "a".repeat(5001) })).toEqual({ comment: "TOO_LONG" });
  });

  it("rejects a missing or blank comment", () => {
    expect(detailsOf({})).toEqual({ comment: "REQUIRED" });
    expect(detailsOf({ comment: null })).toEqual({ comment: "REQUIRED" });
    expect(detailsOf({ comment: " \n\t " })).toEqual({ comment: "REQUIRED" });
    expect(detailsOf(null)).toEqual({ comment: "REQUIRED" });
  });

  it("rejects a non-string comment", () => {
    expect(detailsOf({ comment: 42 })).toEqual({ comment: "INVALID_TYPE" });
    expect(detailsOf({ comment: ["text"] })).toEqual({ comment: "INVALID_TYPE" });
  });

  it("returns the trimmed comment", () => {
    expect(validateFeedbackInput({ comment: "  Well done  " })).toEqual({ comment: "Well done" });
  });

  it("counts the length after trimming", () => {
    expect(detailsOf({ comment: `  ${"a".repeat(5000)}  ` })).toBeUndefined();
  });
});
