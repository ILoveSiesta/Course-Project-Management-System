import { describe, it, expect } from "vitest";
import { validateMilestoneInput, validateMilestoneUpdate } from "../../src/utils/validation.js";
import { HttpError } from "../../src/utils/httpError.js";

// Defect #94 group A (DEF-DEADLINE): exact deadline format (F-02 v0.5 §2, F-05 v0.5 §2, SDS §4).
// Years are derived from the current year so that "future" stays true for create (BR-04).

const Y = new Date().getUTCFullYear() + 2;
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
let LEAP = Y;
while (!isLeap(LEAP)) LEAP += 1;
let NON_LEAP = Y;
while (isLeap(NON_LEAP)) NON_LEAP += 1;

const INVALID = [
  `${Y}-02-30T12:00:00.000Z`, // impossible day
  `${Y}-04-31T12:00:00Z`, // April has 30 days
  `${NON_LEAP}-02-29T12:00:00Z`, // not a leap year
  `${Y}-13-01T12:00:00Z`, // month 13
  `${Y}-05-05T24:00:00Z`, // hour 24
  `${Y}-05-05T10:60:00Z`, // minute 60
  `${Y}-05-05T10:00:60Z`, // second 60
  `${Y}-05-05T10:00:00+24:00`, // offset hour 24
  `${Y}`, // year only
  `${Y}-05-05`, // date only
  `${Y}-05-05T10:00:00`, // no zone: meaning depends on the server time zone
  `${Y}-05-05T10:00`, // no zone, minutes only
  `05/06/${Y}`, // month-first local format
  `${Y}-05-05 10:00Z`, // space separator
  `x ${Y}`, // free text with a year
  `${Y}-5-5T10:00:00Z`, // one-digit month and day
  ` ${Y}-05-05T10:00:00Z`, // leading space
];

const VALID: Array<[string, string]> = [
  [`${LEAP}-02-29T12:00:00.000Z`, `${LEAP}-02-29T12:00:00.000Z`],
  [`${Y}-05-05T10:00+07:00`, `${Y}-05-05T03:00:00.000Z`],
  [`${Y}-05-05T10:00:30-03:30`, `${Y}-05-05T13:30:30.000Z`],
  [`${Y}-05-05T10:00:00.5Z`, `${Y}-05-05T10:00:00.500Z`],
  [`${Y}-12-31T23:59:59.999Z`, `${Y}-12-31T23:59:59.999Z`],
  ["9999-12-31T23:59:59.999Z", "9999-12-31T23:59:59.999Z"],
  [new Date(Date.UTC(Y, 0, 15, 8, 30)).toISOString(), new Date(Date.UTC(Y, 0, 15, 8, 30)).toISOString()],
];

function createDetails(deadline: string): Record<string, string> | undefined {
  try {
    validateMilestoneInput({ title: "Milestone", deadline }, new Date());
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    return (err as HttpError).details;
  }
}

function updateDetails(deadline: string): Record<string, string> | undefined {
  try {
    validateMilestoneUpdate({ deadline });
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    return (err as HttpError).details;
  }
}

describe("TEST-02-16: exact milestone deadline format (create and edit)", () => {
  it.each(INVALID)("rejects %j with INVALID_DATE on create and edit", (value) => {
    expect(createDetails(value)).toEqual({ deadline: "INVALID_DATE" });
    expect(updateDetails(value)).toEqual({ deadline: "INVALID_DATE" });
  });

  it.each(VALID)("accepts %j and keeps the instant %s", (value, instant) => {
    expect(validateMilestoneInput({ title: "Milestone", deadline: value }, new Date()).deadline.toISOString()).toBe(instant);
    expect(validateMilestoneUpdate({ deadline: value }).deadline?.toISOString()).toBe(instant);
  });
});
