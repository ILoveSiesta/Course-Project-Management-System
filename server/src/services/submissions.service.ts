import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AuthenticatedUser } from "../middleware/auth.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { calculateDaysLate, validateSubmissionInput } from "../utils/submissionValidation.js";

const submissionInclude = {
  submittedBy: { select: { id: true, name: true } },
} satisfies Prisma.SubmissionInclude;

type SubmissionWithSubmitter = Prisma.SubmissionGetPayload<{ include: typeof submissionInclude }>;

function toSubmissionDto(s: SubmissionWithSubmitter) {
  return {
    id: s.id,
    milestoneId: s.milestoneId,
    version: s.version,
    title: s.title,
    description: s.description,
    link: s.link,
    submittedAt: s.submittedAt.toISOString(),
    daysLate: s.daysLate,
    submittedBy: s.submittedBy,
  };
}

function teamScopeFilter(user: AuthenticatedUser): Prisma.TeamWhereInput {
  return user.role === "STUDENT"
    ? { memberships: { some: { studentId: user.id } } }
    : { supervisorAssignments: { some: { supervisorId: user.id } } };
}

async function findMilestoneInScope(user: AuthenticatedUser, milestoneId: number) {
  const milestone = await getPrisma().milestone.findFirst({
    where: { id: milestoneId, team: teamScopeFilter(user) },
    include: { team: true },
  });
  if (!milestone) throw notFound();
  return milestone;
}

export async function listSubmissions(user: AuthenticatedUser, milestoneId: number) {
  await findMilestoneInScope(user, milestoneId);

  const submissions = await getPrisma().submission.findMany({
    where: { milestoneId },
    include: submissionInclude,
    orderBy: { version: "asc" },
  });

  return submissions.map(toSubmissionDto);
}

// Student submits or resubmits work for a milestone of their own team (BR-01, BR-05, BR-06, BR-07, BR-08).
export async function createSubmission(user: AuthenticatedUser, milestoneId: number, body: unknown) {
  // Scope check before validation: student can only submit to milestones of own team.
  // If milestone not found or not own team -> 404 (no disclosure).
  const ownMilestone = await getPrisma().milestone.findFirst({
    where: {
      id: milestoneId,
      team: { memberships: { some: { studentId: user.id } } },
    },
  });
  if (!ownMilestone) throw notFound();

  // Field validation (throws 400 VALIDATION_ERROR with details if invalid)
  const input = validateSubmissionInput(body);

  // Concurrency safe transaction: lock milestone row to serialize parallel submissions (NFR-06)
  return await getPrisma().$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<Array<{ id: number; deadline: Date }>>`
      SELECT id, deadline FROM "Milestone" WHERE id = ${milestoneId} FOR UPDATE
    `;
    if (!locked) throw notFound();

    const existingCount = await tx.submission.count({
      where: { milestoneId },
    });

    if (existingCount >= 3) {
      throw new HttpError(409, "VERSION_LIMIT_REACHED", "Maximum of 3 versions reached for this milestone");
    }

    const nextVersion = existingCount + 1;
    const now = new Date();
    const daysLate = calculateDaysLate(now, new Date(locked.deadline));

    const created = await tx.submission.create({
      data: {
        milestoneId,
        submittedById: user.id,
        version: nextVersion,
        title: input.title,
        description: input.description,
        link: input.link,
        submittedAt: now,
        daysLate,
      },
      include: submissionInclude,
    });

    return toSubmissionDto(created);
  });
}

export async function getSubmission(user: AuthenticatedUser, submissionId: number) {
  const submission = await getPrisma().submission.findFirst({
    where: {
      id: submissionId,
      milestone: { team: teamScopeFilter(user) },
    },
    include: submissionInclude,
  });

  if (!submission) throw notFound();
  return toSubmissionDto(submission);
}
