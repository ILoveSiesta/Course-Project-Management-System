import { HttpError } from "./httpError.js";

export interface SubmissionInput {
  title: string;
  description: string | null;
  link: string;
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;
const LINK_MAX = 2048;
const DAY_MS = 24 * 60 * 60 * 1000;

// BR-05: Submissions at or before deadline have daysLate = 0.
// Submissions after deadline have daysLate = ceil((submittedAt - deadline) / 24 h).
export function calculateDaysLate(submittedAt: Date, deadline: Date): number {
  const diff = submittedAt.getTime() - deadline.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}

// BR-08: title 1–120 characters after trimming, optional description up to 2000 characters,
// link absolute http or https URL up to 2048 characters.
export function validateSubmissionInput(body: unknown): SubmissionInput {
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

  let link = "";
  if (input.link === undefined || input.link === null || input.link === "") {
    details.link = "REQUIRED";
  } else if (typeof input.link !== "string") {
    details.link = "INVALID_TYPE";
  } else {
    link = input.link.trim();
    if (!link) {
      details.link = "REQUIRED";
    } else if (link.length > LINK_MAX) {
      details.link = "TOO_LONG";
    } else {
      try {
        const parsed = new URL(link);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          details.link = "INVALID_URL";
        }
      } catch {
        details.link = "INVALID_URL";
      }
    }
  }

  if (Object.keys(details).length > 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid submission", details);
  }

  return { title, description, link };
}
