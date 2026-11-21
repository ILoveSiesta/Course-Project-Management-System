import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AuthenticatedUser } from "../middleware/auth.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { validateGradeInput } from "../utils/validation.js";
import { scopeFilter } from "./teams.service.js";

// F-08 Grades and grade release (FR-18, FR-19, BR-11). Contract: docs/sprints/sprint-2/F-08-grades.md.

const gradeInclude = {
  submission: { select: { version: true } },
  gradedBy: { select: { id: true, name: true } },
} satisfies Prisma.GradeInclude;

type GradeWithLinks = Prisma.GradeGetPayload<{ include: typeof gradeInclude }>;

function toGradeState(grade: GradeWithLinks | null, releasedAt: Date | null) {
  return {
    grade: grade && {
      score: grade.score,
      version: grade.submission.version,
      submissionId: grade.submissionId,
      gradedBy: grade.gradedBy,
      gradedAt: grade.updatedAt.toISOString(),
    },
    released: releasedAt !== null,
    releasedAt: releasedAt ? releasedAt.toISOString() : null,
  };
}

const gradeReleased = () =>
  new HttpError(409, "GRADE_RELEASED", "Grades for this milestone have been released and can no longer be changed");

async function findMilestoneInScope(user: AuthenticatedUser, milestoneId: number) {
  const milestone = await getPrisma().milestone.findFirst({
    where: { id: milestoneId, team: scopeFilter(user) },
    select: { id: true },
  });
  if (!milestone) throw notFound();
}

// Locks the milestone row so that a save and a release of the same milestone never interleave.
async function lockMilestone(tx: Prisma.TransactionClient, milestoneId: number) {
  const [row] = await tx.$queryRaw<Array<{ gradesReleasedAt: Date | null }>>`
    SELECT "gradesReleasedAt" FROM "Milestone" WHERE id = ${milestoneId} FOR UPDATE
  `;
  if (!row) throw notFound();
  return row.gradesReleasedAt;
}

// G5: a student gets no grade data before release, whether or not a grade exists.
export async function getGrade(user: AuthenticatedUser, milestoneId: number) {
  await findMilestoneInScope(user, milestoneId);
  const milestone = await getPrisma().milestone.findUniqueOrThrow({
    where: { id: milestoneId },
    select: { gradesReleasedAt: true, grade: { include: gradeInclude } },
  });
  if (user.role === "STUDENT" && milestone.gradesReleasedAt === null) {
    return toGradeState(null, null);
  }
  return toGradeState(milestone.grade, milestone.gradesReleasedAt);
}

// Save order: 404 scope → 400 format → 409 NOTHING_TO_GRADE → 400 version not in this milestone → 409 released.
export async function saveGrade(user: AuthenticatedUser, milestoneId: number, body: unknown) {
  await findMilestoneInScope(user, milestoneId);
  const input = validateGradeInput(body);

  return getPrisma().$transaction(async (tx) => {
    const releasedAt = await lockMilestone(tx, milestoneId);

    const submissions = await tx.submission.findMany({ where: { milestoneId }, select: { id: true, version: true } });
    if (submissions.length === 0) {
      throw new HttpError(409, "NOTHING_TO_GRADE", "There is no submission to grade");
    }
    // G2: the version is looked up only inside this milestone.
    const graded = submissions.find((s) => s.version === input.version);
    if (!graded) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid grade", { version: "NOT_FOUND" });
    }
    if (releasedAt !== null) throw gradeReleased();

    const data = { submissionId: graded.id, score: input.score, gradedById: user.id };
    const grade = await tx.grade.upsert({
      where: { milestoneId },
      create: { milestoneId, ...data },
      update: data,
      include: gradeInclude,
    });
    return toGradeState(grade, null);
  });
}

// Release order: 404 scope → 409 GRADE_RELEASED → 409 NO_GRADE. Irreversible; the first release time is kept.
export async function releaseGrade(user: AuthenticatedUser, milestoneId: number) {
  await findMilestoneInScope(user, milestoneId);

  return getPrisma().$transaction(async (tx) => {
    const releasedAt = await lockMilestone(tx, milestoneId);
    if (releasedAt !== null) throw gradeReleased();

    const grade = await tx.grade.findUnique({ where: { milestoneId }, include: gradeInclude });
    if (!grade) throw new HttpError(409, "NO_GRADE", "Record a grade before releasing");

    const milestone = await tx.milestone.update({
      where: { id: milestoneId },
      data: { gradesReleasedAt: new Date() },
      select: { gradesReleasedAt: true },
    });
    return toGradeState(grade, milestone.gradesReleasedAt);
  });
}
