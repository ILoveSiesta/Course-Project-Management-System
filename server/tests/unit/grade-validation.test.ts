import { describe, it, expect } from "vitest";
import * as validation from "../../src/utils/validation.js";
import { HttpError } from "../../src/utils/httpError.js";

// F-08 (contract docs/sprints/sprint-2/F-08-grades.md). Looked up from the module object so that this file
// still type-checks before the helper exists; at RED the test fails at run time.
const validateGradeInput = (validation as Record<string, unknown>).validateGradeInput as (
  body: unknown
) => { score: number; version: number };

function detailsOf(body: unknown): Record<string, string> | undefined {
  try {
    validateGradeInput(body);
    return undefined;
  } catch (err) {
    if (err instanceof HttpError) return err.details;
    throw err;
  }
}

describe("F-08 validateGradeInput", () => {
  it("TEST-08-08: score is an integer 0-100 and version a positive integer", () => {
    expect(validateGradeInput({ score: 0, version: 1 })).toEqual({ score: 0, version: 1 });
    expect(validateGradeInput({ score: 100, version: 3 })).toEqual({ score: 100, version: 3 });

    expect(detailsOf({ score: -1, version: 1 })).toEqual({ score: "OUT_OF_RANGE" });
    expect(detailsOf({ score: 101, version: 1 })).toEqual({ score: "OUT_OF_RANGE" });
    expect(detailsOf({ score: 85.5, version: 1 })).toEqual({ score: "INVALID_TYPE" });
    expect(detailsOf({ score: "85", version: 1 })).toEqual({ score: "INVALID_TYPE" });
    expect(detailsOf({ version: 1 })).toEqual({ score: "REQUIRED" });

    expect(detailsOf({ score: 50, version: 0 })).toEqual({ version: "INVALID_TYPE" });
    expect(detailsOf({ score: 50, version: 1.5 })).toEqual({ version: "INVALID_TYPE" });
    expect(detailsOf({ score: 50, version: "1" })).toEqual({ version: "INVALID_TYPE" });
    expect(detailsOf({ score: 50 })).toEqual({ version: "REQUIRED" });

    expect(detailsOf({})).toEqual({ score: "REQUIRED", version: "REQUIRED" });
  });
});
