import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AuthenticatedUser } from "../middleware/auth.js";
import { notFound } from "../utils/httpError.js";
import { validateFeedbackInput } from "../utils/feedbackValidation.js";
import { scopeFilter } from "./teams.service.js";

export const feedbackInclude = {
  author: { select: { id: true, name: true } },
} satisfies Prisma.FeedbackInclude;

type FeedbackWithAuthor = Prisma.FeedbackGetPayload<{ include: typeof feedbackInclude }>;

export function toFeedbackDto(f: FeedbackWithAuthor) {
  return {
    id: f.id,
    submissionId: f.submissionId,
    comment: f.comment,
    createdAt: f.createdAt.toISOString(),
    author: f.author,
  };
}

// Supervisor records feedback on one submission version (FR-16, BR-09).
// Role is checked by requireRole("SUPERVISOR") on the route; scope is checked here, before validation.
export async function createFeedback(user: AuthenticatedUser, submissionId: number, body: unknown) {
  const submission = await getPrisma().submission.findFirst({
    where: { id: submissionId, milestone: { team: scopeFilter(user) } },
    select: { id: true },
  });
  if (!submission) throw notFound();

  const { comment } = validateFeedbackInput(body);
  const feedback = await getPrisma().feedback.create({
    data: { submissionId, authorId: user.id, comment },
    include: feedbackInclude,
  });
  return toFeedbackDto(feedback);
}
