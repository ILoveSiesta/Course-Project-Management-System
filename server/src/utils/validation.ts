import { HttpError } from "./httpError.js";

export interface MilestoneInput {
  title: string;
  description: string | null;
  deadline: Date;
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

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
    else if (title.length > TITLE_MAX) details.title = "TOO_LONG";
  }

  let description: string | null = null;
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") {
      details.description = "INVALID_TYPE";
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
    deadline = new Date(input.deadline);
    if (Number.isNaN(deadline.getTime())) details.deadline = "INVALID_DATE";
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
      else if (title.length > TITLE_MAX) details.title = "TOO_LONG";
      else update.title = title;
    }
  }

  if ("description" in input) {
    if (input.description === null) {
      update.description = null;
    } else if (typeof input.description !== "string") {
      details.description = "INVALID_TYPE";
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
      const deadline = new Date(input.deadline);
      if (Number.isNaN(deadline.getTime())) details.deadline = "INVALID_DATE";
      else update.deadline = deadline;
    }
  }

  if (Object.keys(details).length > 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid milestone", details);
  }
  return update;
}
