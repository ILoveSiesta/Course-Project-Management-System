import { describe, it, expect } from "vitest";
import * as validation from "../../src/utils/validation.js";
import { validateMilestoneInput, validateMilestoneUpdate, validateTeamName } from "../../src/utils/validation.js";
import { validateSubmissionInput } from "../../src/utils/submissionValidation.js";
import { validateFeedbackInput } from "../../src/utils/feedbackValidation.js";
import { HttpError } from "../../src/utils/httpError.js";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const FUTURE = "2026-12-20T00:00:00.000Z";

// Lookup from module object so the file still compiles cleanly in RED before the helper is exported.
const hasInvalidTextCharacters = (validation as Record<string, unknown>).hasInvalidTextCharacters as (
  value: string
) => boolean;

function captureValidationError(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    return err as HttpError;
  }
  throw new Error("Expected function to throw HttpError");
}

describe("Defect #90 (DEF-BAD-INPUT): invalid text characters and milestone year bounds", () => {
  it("TEST-90-U01: hasInvalidTextCharacters detects NUL and unpaired UTF-16 surrogates while allowing valid pairs", () => {
    expect(typeof hasInvalidTextCharacters).toBe("function");
    expect(hasInvalidTextCharacters("Project Milestone 🚀 ภาษาไทย")).toBe(false);
    expect(hasInvalidTextCharacters("\ud83d\ude00")).toBe(false);

    expect(hasInvalidTextCharacters("abc\u0000def")).toBe(true);
    expect(hasInvalidTextCharacters("\ud800")).toBe(true);
    expect(hasInvalidTextCharacters("abc\udfff")).toBe(true);
    expect(hasInvalidTextCharacters("\udc00\ud800")).toBe(true);
  });

  it("TEST-90-U02: rejects NUL and unpaired surrogates with INVALID_CHARACTER across all domain text validators", () => {
    for (const bad of ["bad\u0000text", "bad\ud800text", "bad\udffftext"]) {
      const mCreateTitle = captureValidationError(() =>
        validateMilestoneInput({ title: bad, deadline: FUTURE }, NOW)
      );
      expect(mCreateTitle.status).toBe(400);
      expect(mCreateTitle.details).toEqual({ title: "INVALID_CHARACTER" });

      const mCreateDesc = captureValidationError(() =>
        validateMilestoneInput({ title: "Valid", description: bad, deadline: FUTURE }, NOW)
      );
      expect(mCreateDesc.status).toBe(400);
      expect(mCreateDesc.details).toEqual({ description: "INVALID_CHARACTER" });

      const mEdit = captureValidationError(() => validateMilestoneUpdate({ title: bad, description: bad }));
      expect(mEdit.status).toBe(400);
      expect(mEdit.details).toEqual({ title: "INVALID_CHARACTER", description: "INVALID_CHARACTER" });

      const sTitle = captureValidationError(() =>
        validateSubmissionInput({ title: bad, link: "https://example.com" })
      );
      expect(sTitle.status).toBe(400);
      expect(sTitle.details).toEqual({ title: "INVALID_CHARACTER" });

      const sDesc = captureValidationError(() =>
        validateSubmissionInput({ title: "Valid", description: bad, link: "https://example.com" })
      );
      expect(sDesc.status).toBe(400);
      expect(sDesc.details).toEqual({ description: "INVALID_CHARACTER" });

      const sLink = captureValidationError(() =>
        validateSubmissionInput({ title: "Valid", link: `https://example.com/${bad}` })
      );
      expect(sLink.status).toBe(400);
      expect(sLink.details).toEqual({ link: "INVALID_CHARACTER" });

      const fb = captureValidationError(() => validateFeedbackInput({ comment: bad }));
      expect(fb.status).toBe(400);
      expect(fb.details).toEqual({ comment: "INVALID_CHARACTER" });

      const team = captureValidationError(() => validateTeamName({ name: bad }));
      expect(team.status).toBe(400);
      expect(team.details).toEqual({ name: "INVALID_CHARACTER" });
    }

    // Positive control: valid UTF-16 surrogate pairs (emoji) stay accepted
    expect(validateMilestoneInput({ title: "Milestone 🚀", deadline: FUTURE }, NOW).title).toBe("Milestone 🚀");
    expect(validateTeamName({ name: "Team 🚀" })).toBe("Team 🚀");
  });

  it("TEST-90-U03: rejects milestone deadline outside ISO years 1..9999 with INVALID_DATE and accepts year 9999", () => {
    for (const badYear of ["+010000-01-01T00:00:00.000Z", "0000-01-01T00:00:00.000Z"]) {
      const createErr = captureValidationError(() =>
        validateMilestoneInput({ title: "Valid", deadline: badYear }, NOW)
      );
      expect(createErr.status).toBe(400);
      expect(createErr.details).toEqual({ deadline: "INVALID_DATE" });

      const editErr = captureValidationError(() => validateMilestoneUpdate({ deadline: badYear }));
      expect(editErr.status).toBe(400);
      expect(editErr.details).toEqual({ deadline: "INVALID_DATE" });
    }

    const maxYear = "9999-12-31T23:59:59.999Z";
    expect(validateMilestoneInput({ title: "Boundary", deadline: maxYear }, NOW).deadline.toISOString()).toBe(maxYear);
    expect(validateMilestoneUpdate({ deadline: maxYear }).deadline?.toISOString()).toBe(maxYear);
  });
});
