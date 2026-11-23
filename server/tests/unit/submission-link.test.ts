import { describe, it, expect } from "vitest";
import { validateSubmissionInput } from "../../src/utils/submissionValidation.js";
import { HttpError } from "../../src/utils/httpError.js";

// Defect #94 group C1 (DEF-F03-CONTRACT): BR-08 link must be an absolute http/https URL (F-03 v0.5 §2).

function linkDetail(link: string): string | undefined {
  try {
    validateSubmissionInput({ title: "Work", link });
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    return (err as HttpError).details?.link;
  }
}

describe("TEST-03-26: submission link must be absolute", () => {
  it.each([
    "https:example.com/doc",
    "https:/example.com/doc",
    "https:///example.com",
    "http:\\\\example.com",
    "https://",
    "https://?q",
    "https:// example.com",
  ])("rejects %j with INVALID_URL", (link) => {
    expect(linkDetail(link)).toBe("INVALID_URL");
  });

  it("accepts absolute http and https links in any letter case and stores the trimmed text", () => {
    expect(linkDetail("https://example.com/doc")).toBeUndefined();
    expect(linkDetail("HTTP://EXAMPLE.COM/a")).toBeUndefined();
    expect(validateSubmissionInput({ title: "Work", link: "  https://example.com/x  " }).link).toBe("https://example.com/x");
  });
});
