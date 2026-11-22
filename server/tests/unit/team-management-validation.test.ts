import { describe, it, expect } from "vitest";
import { parseId } from "../../src/utils/httpError.js";
import { validateAddMemberInput, validateTeamName } from "../../src/utils/validation.js";

// F-13 (FR-07): pure validation boundary checks (STS TEST-13-11).
describe("F-13 team management validation", () => {
  it("TEST-13-11: validates team name boundaries and add-member studentId", () => {
    // Valid trimmed team name up to 80 characters
    expect(validateTeamName({ name: "  Team Delta  " })).toBe("Team Delta");
    const maxName = "T".repeat(80);
    expect(validateTeamName({ name: maxName })).toBe(maxName);

    // Invalid team names -> 400 VALIDATION_ERROR
    expect(() => validateTeamName({})).toThrowError();
    expect(() => validateTeamName({ name: "   " })).toThrowError();
    expect(() => validateTeamName({ name: 123 })).toThrowError();
    expect(() => validateTeamName({ name: "T".repeat(81) })).toThrowError();

    for (const [body, expectedCode] of [
      [{}, "REQUIRED"],
      [{ name: null }, "REQUIRED"],
      [{ name: "   " }, "REQUIRED"],
      [{ name: 42 }, "INVALID_TYPE"],
      [{ name: "x".repeat(81) }, "TOO_LONG"],
    ] as const) {
      let caught: { status?: number; code?: string; details?: Record<string, string> } | undefined;
      try {
        validateTeamName(body);
      } catch (err) {
        caught = err as typeof caught;
      }
      expect(caught?.status).toBe(400);
      expect(caught?.code).toBe("VALIDATION_ERROR");
      expect(caught?.details?.name).toBe(expectedCode);
    }

    // Valid positive integer studentId
    expect(validateAddMemberInput({ studentId: 5 })).toBe(5);

    // Invalid studentId -> 400 VALIDATION_ERROR
    for (const [body, expectedCode] of [
      [{}, "REQUIRED"],
      [{ studentId: null }, "REQUIRED"],
      [{ studentId: "5" }, "INVALID_TYPE"],
      [{ studentId: 1.5 }, "INVALID_TYPE"],
      [{ studentId: 0 }, "INVALID_TYPE"],
      [{ studentId: -3 }, "INVALID_TYPE"],
    ] as const) {
      let caught: { status?: number; code?: string; details?: Record<string, string> } | undefined;
      try {
        validateAddMemberInput(body);
      } catch (err) {
        caught = err as typeof caught;
      }
      expect(caught?.status).toBe(400);
      expect(caught?.code).toBe("VALIDATION_ERROR");
      expect(caught?.details?.studentId).toBe(expectedCode);
    }
  });

  it("TEST-13-18 (unit): parseId accepts INT4 max (2147483647) and rejects overflow (2147483648) as 404", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("2147483647")).toBe(2147483647);

    for (const raw of ["0", "-1", "1.5", "abc", "2147483648", "999999999999"]) {
      let caught: { status?: number; code?: string } | undefined;
      try {
        parseId(raw);
      } catch (err) {
        caught = err as typeof caught;
      }
      expect(caught?.status).toBe(404);
      expect(caught?.code).toBe("NOT_FOUND");
    }
  });
});
