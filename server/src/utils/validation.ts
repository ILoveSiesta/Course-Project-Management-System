import { HttpError } from "./httpError.js";

export interface MilestoneInput {
  title: string;
  description: string | null;
  deadline: Date;
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

// Reject NUL (U+0000) and unpaired UTF-16 surrogates, which PostgreSQL UTF-8 rejects (SQLSTATE 22021).
// Valid surrogate pairs (high 0xD800..0xDBFF followed by low 0xDC00..0xDFFF) are accepted.
export function hasInvalidTextCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0) return true;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : -1;
      if (next < 0xdc00 || next > 0xdfff) return true;
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function isValidMilestoneDate(date: Date): boolean {
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= 1 && year <= 9999;
}

// #94 DEF-DEADLINE (F-02 v0.5 §2, SDS §4): YYYY-MM-DDTHH:mm[:ss[.fff]] with a required zone (Z or ±HH:MM).
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

// Parses a milestone deadline. Returns an invalid Date unless the string has the exact format and its
// calendar values exist, so `new Date()` cannot repair "2027-02-30" or guess a zone for "2027-05-05T10:00".
export function parseMilestoneDeadline(value: string): Date {
  const m = ISO_DATE_TIME.exec(value);
  if (!m) return new Date(NaN);
  const [year, month, day, hour, minute] = [1, 2, 3, 4, 5].map((i) => Number(m[i]));
  const second = m[6] === undefined ? 0 : Number(m[6]);
  const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(2000, month, 0)).getUTCDate() : 0;
  const leapDay = month === 2 && day === 29;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || (leapDay && !isLeap)) return new Date(NaN);
  if (hour > 23 || minute > 59 || second > 59) return new Date(NaN);
  if (m[7] !== undefined && (Number(m[8]) > 23 || Number(m[9]) > 59)) return new Date(NaN);
  return new Date(value);
}

// BR-04: title 1–120 characters after trimming, optional description up to 2000 characters,
// deadline strictly later than `now`. Collects every invalid field before rejecting.
export function validateMilestoneInput(body: unknown, now: Date): MilestoneInput {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const details: Record<string, string> = {};

  let title = "";
  if (input.title === undefined || input.title === null) {
    details.title = "REQUIRED";
  } else if (typeof input.title !== "string") {
    details.title = "INVALID_TYPE";
  } else {
    title = input.title.trim();
    if (!title) details.title = "REQUIRED";
    else if (hasInvalidTextCharacters(input.title)) details.title = "INVALID_CHARACTER";
    else if (title.length > TITLE_MAX) details.title = "TOO_LONG";
  }

  let description: string | null = null;
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") {
      details.description = "INVALID_TYPE";
    } else if (hasInvalidTextCharacters(input.description)) {
      details.description = "INVALID_CHARACTER";
    } else if (input.description.length > DESCRIPTION_MAX) {
      details.description = "TOO_LONG";
    } else {
      description = input.description.trim() || null;
    }
  }

  let deadline = new Date(NaN);
  if (input.deadline === undefined || input.deadline === null || input.deadline === "") {
    details.deadline = "REQUIRED";
  } else if (typeof input.deadline !== "string") {
    details.deadline = "INVALID_TYPE";
  } else {
    deadline = parseMilestoneDeadline(input.deadline);
    if (!isValidMilestoneDate(deadline)) details.deadline = "INVALID_DATE";
    else if (deadline.getTime() <= now.getTime()) details.deadline = "MUST_BE_FUTURE";
  }

  if (Object.keys(details).length > 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid milestone", details);
  }
  return { title, description, deadline };
}

const MAX_TEAMS = 20;

// F-06 (FR-11): the team list of a multi-team milestone: 1–20 distinct positive integer IDs.
export function validateTeamIds(body: unknown): number[] {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const raw = input.teamIds;

  let code: string | undefined;
  if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) {
    code = "REQUIRED";
  } else if (!Array.isArray(raw) || !raw.every((id) => typeof id === "number" && Number.isInteger(id) && id > 0)) {
    code = "INVALID_TYPE";
  } else if (new Set(raw).size !== raw.length) {
    code = "DUPLICATE";
  } else if (raw.length > MAX_TEAMS) {
    code = "TOO_MANY";
  }

  if (code) throw new HttpError(400, "VALIDATION_ERROR", "Invalid team selection", { teamIds: code });
  return raw as number[];
}

export interface GradeInput {
  score: number;
  version: number;
}

// F-08 (BR-11, G1/G2): score is an integer 0–100, version a positive integer (a version number of the milestone;
// whether it exists in the milestone is checked by the service). Collects both fields before rejecting.
export function validateGradeInput(body: unknown): GradeInput {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const details: Record<string, string> = {};
  const isInteger = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

  if (input.score === undefined || input.score === null) details.score = "REQUIRED";
  else if (!isInteger(input.score)) details.score = "INVALID_TYPE";
  else if (input.score < 0 || input.score > 100) details.score = "OUT_OF_RANGE";

  if (input.version === undefined || input.version === null) details.version = "REQUIRED";
  else if (!isInteger(input.version) || input.version <= 0) details.version = "INVALID_TYPE";

  if (Object.keys(details).length > 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid grade", details);
  }
  return { score: input.score as number, version: input.version as number };
}

export interface MilestoneUpdate {
  title?: string;
  description?: string | null;
  deadline?: Date;
}

// F-05 (FR-10): partial update. Field rules follow BR-04; a deadline only has to be a valid date here.
// Whether it extends the stored deadline (BR-13) is checked by the service against the database.
export function validateMilestoneUpdate(body: unknown): MilestoneUpdate {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const details: Record<string, string> = {};
  const update: MilestoneUpdate = {};

  if (!("title" in input) && !("description" in input) && !("deadline" in input)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid milestone", { body: "NO_CHANGES" });
  }

  if ("title" in input) {
    if (typeof input.title !== "string") {
      details.title = "INVALID_TYPE";
    } else {
      const title = input.title.trim();
      if (!title) details.title = "REQUIRED";
      else if (hasInvalidTextCharacters(input.title)) details.title = "INVALID_CHARACTER";
      else if (title.length > TITLE_MAX) details.title = "TOO_LONG";
      else update.title = title;
    }
  }

  if ("description" in input) {
    if (input.description === null) {
      update.description = null;
    } else if (typeof input.description !== "string") {
      details.description = "INVALID_TYPE";
    } else if (hasInvalidTextCharacters(input.description)) {
      details.description = "INVALID_CHARACTER";
    } else if (input.description.length > DESCRIPTION_MAX) {
      details.description = "TOO_LONG";
    } else {
      update.description = input.description.trim() || null;
    }
  }

  if ("deadline" in input) {
    if (typeof input.deadline !== "string") {
      details.deadline = "INVALID_TYPE";
    } else {
      const deadline = parseMilestoneDeadline(input.deadline);
      if (!isValidMilestoneDate(deadline)) details.deadline = "INVALID_DATE";
      else update.deadline = deadline;
    }
  }

  if (Object.keys(details).length > 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid milestone", details);
  }
  return update;
}

export type MilestoneStatus =
  | "Not submitted"
  | "Overdue"
  | "Submitted"
  | "Submitted late"
  | "Reviewed";

// F-09 (FR-20, BR-12): derived status evaluated in priority order at request time; first match wins.
// Overdue covers both the 7-day late window and after it closes (CHG-03 / Issue #67 Option A).
export function deriveMilestoneStatus(input: {
  deadline: Date;
  now: Date;
  latestSubmission: { daysLate: number; feedbackCount: number } | null;
}): MilestoneStatus {
  const { deadline, now, latestSubmission } = input;
  if (latestSubmission) {
    if (latestSubmission.feedbackCount > 0) return "Reviewed";
    return latestSubmission.daysLate > 0 ? "Submitted late" : "Submitted";
  }
  return now.getTime() > deadline.getTime() ? "Overdue" : "Not submitted";
}

const TEAM_NAME_MAX = 80;

// F-13 (FR-07): team name is a trimmed string 1–80 characters.
export function validateTeamName(body: unknown): string {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const raw = input.name;

  if (raw === undefined || raw === null) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid team", { name: "REQUIRED" });
  }
  if (typeof raw !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid team", { name: "INVALID_TYPE" });
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid team", { name: "REQUIRED" });
  }
  if (hasInvalidTextCharacters(raw)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid team", { name: "INVALID_CHARACTER" });
  }
  if (trimmed.length > TEAM_NAME_MAX) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid team", { name: "TOO_LONG" });
  }
  return trimmed;
}

// F-13 (FR-07): target user ID when adding a student to a team must be a positive integer.
export function validateAddMemberInput(body: unknown): number {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const raw = input.studentId;

  if (raw === undefined || raw === null) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid team member", { studentId: "REQUIRED" });
  }
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid team member", { studentId: "INVALID_TYPE" });
  }
  return raw;
}
