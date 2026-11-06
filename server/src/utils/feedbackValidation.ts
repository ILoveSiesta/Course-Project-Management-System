import { HttpError } from "./httpError.js";

const COMMENT_MAX = 5000;

// BR-09: comment is required, 1–5000 characters after trimming.
export function validateFeedbackInput(body: unknown): { comment: string } {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  let code: string | undefined;
  let comment = "";

  if (input.comment === undefined || input.comment === null) {
    code = "REQUIRED";
  } else if (typeof input.comment !== "string") {
    code = "INVALID_TYPE";
  } else {
    comment = input.comment.trim();
    if (!comment) code = "REQUIRED";
    else if (comment.length > COMMENT_MAX) code = "TOO_LONG";
  }

  if (code) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid feedback", { comment: code });
  }
  return { comment };
}
