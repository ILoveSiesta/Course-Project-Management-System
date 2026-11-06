import { describe, it, expect } from "vitest";
import { calculateDaysLate, validateSubmissionInput } from "../../src/utils/submissionValidation.js";

describe("F-03 Submission Rules Unit Tests", () => {
  describe("BR-05: calculateDaysLate", () => {
    const deadline = new Date("2026-11-08T23:59:00.000Z");

    it("returns 0 when submitted before the deadline", () => {
      const submittedAt = new Date("2026-11-08T20:00:00.000Z");
      expect(calculateDaysLate(submittedAt, deadline)).toBe(0);
    });

    it("returns 0 when submitted exactly at the deadline", () => {
      const submittedAt = new Date("2026-11-08T23:59:00.000Z");
      expect(calculateDaysLate(submittedAt, deadline)).toBe(0);
    });

    it("returns 1 when submitted 1 second after the deadline", () => {
      const submittedAt = new Date("2026-11-08T23:59:01.000Z");
      expect(calculateDaysLate(submittedAt, deadline)).toBe(1);
    });

    it("returns 1 when submitted 12 hours after the deadline", () => {
      const submittedAt = new Date(deadline.getTime() + 12 * 60 * 60 * 1000);
      expect(calculateDaysLate(submittedAt, deadline)).toBe(1);
    });

    it("returns 1 when submitted exactly 24 hours after the deadline", () => {
      const submittedAt = new Date(deadline.getTime() + 24 * 60 * 60 * 1000);
      expect(calculateDaysLate(submittedAt, deadline)).toBe(1);
    });

    it("returns 2 when submitted 24 hours and 1 millisecond after the deadline", () => {
      const submittedAt = new Date(deadline.getTime() + 24 * 60 * 60 * 1000 + 1);
      expect(calculateDaysLate(submittedAt, deadline)).toBe(2);
    });

    it("returns 2 when submitted 48 hours after the deadline", () => {
      const submittedAt = new Date(deadline.getTime() + 48 * 60 * 60 * 1000);
      expect(calculateDaysLate(submittedAt, deadline)).toBe(2);
    });

    it("returns 3 when submitted 48 hours and 1 second after the deadline", () => {
      const submittedAt = new Date(deadline.getTime() + 48 * 60 * 60 * 1000 + 1000);
      expect(calculateDaysLate(submittedAt, deadline)).toBe(3);
    });
  });

  describe("BR-08: validateSubmissionInput", () => {
    it("accepts valid title, description, and http/https link", () => {
      const res = validateSubmissionInput({
        title: "  Final Report  ",
        description: "  Completed work  ",
        link: "https://github.com/my-team/project",
      });
      expect(res).toEqual({
        title: "Final Report",
        description: "Completed work",
        link: "https://github.com/my-team/project",
      });
    });

    it("accepts null or empty description and normalises it to null", () => {
      const res1 = validateSubmissionInput({
        title: "Report",
        description: "",
        link: "https://example.com/doc",
      });
      expect(res1.description).toBeNull();

      const res2 = validateSubmissionInput({
        title: "Report",
        link: "https://example.com/doc",
      });
      expect(res2.description).toBeNull();
    });

    it("accepts a title of exactly 120 characters and link of 2048 characters", () => {
      const title = "a".repeat(120);
      const link = "https://example.com/" + "b".repeat(2028); // 2048 chars
      const res = validateSubmissionInput({ title, link });
      expect(res.title).toBe(title);
      expect(res.link).toBe(link);
    });

    it("rejects missing, blank or excessively long title", () => {
      expect(() => validateSubmissionInput({ link: "https://example.com" })).toThrowError();
      expect(() => validateSubmissionInput({ title: "   ", link: "https://example.com" })).toThrowError();
      expect(() =>
        validateSubmissionInput({ title: "a".repeat(121), link: "https://example.com" })
      ).toThrowError();
    });

    it("rejects invalid links: missing, non-string, not http/https, or too long", () => {
      expect(() => validateSubmissionInput({ title: "Report" })).toThrowError();
      expect(() => validateSubmissionInput({ title: "Report", link: "not-a-valid-url" })).toThrowError();
      expect(() => validateSubmissionInput({ title: "Report", link: "ftp://files.example.com" })).toThrowError();
      expect(() =>
        validateSubmissionInput({ title: "Report", link: "https://example.com/" + "x".repeat(2035) })
      ).toThrowError();
    });

    it("rejects description longer than 2000 characters", () => {
      expect(() =>
        validateSubmissionInput({
          title: "Report",
          description: "x".repeat(2001),
          link: "https://example.com",
        })
      ).toThrowError();
    });
  });
});
