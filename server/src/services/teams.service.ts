import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AuthenticatedUser } from "../middleware/auth.js";
import { HttpError, PG_INT4_MAX, notFound } from "../utils/httpError.js";
import {
  deriveMilestoneStatus,
  validateAddMemberInput,
  validateMilestoneInput,
  validateMilestoneUpdate,
  validateTeamIds,
  validateTeamName,
} from "../utils/validation.js";

const personSelect = { id: true, name: true, email: true } as const;

const teamInclude = {
  memberships: { include: { student: { select: personSelect } } },
  supervisorAssignments: { include: { supervisor: { select: personSelect } } },
} satisfies Prisma.TeamInclude;

const milestoneInclude = {
  createdBy: { select: { id: true, name: true } },
  // F-09 (no N+1): load only the latest submission version and its feedback count.
  submissions: {
    orderBy: { version: "desc" },
    take: 1,
    select: {
      version: true,
      daysLate: true,
      _count: { select: { feedback: true } },
    },
  },
} satisfies Prisma.MilestoneInclude;

type TeamWithPeople = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;
type MilestoneWithCreator = Prisma.MilestoneGetPayload<{ include: typeof milestoneInclude }>;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

function toTeamDto(team: TeamWithPeople) {
  return {
    id: team.id,
    name: team.name,
    members: team.memberships.map((m) => m.student).sort(byName),
    supervisors: team.supervisorAssignments.map((a) => a.supervisor).sort(byName),
  };
}

function toMilestoneDto(m: MilestoneWithCreator, now: Date = new Date()) {
  const latest = m.submissions[0];
  const status = deriveMilestoneStatus({
    deadline: m.deadline,
    now,
    latestSubmission: latest
      ? { daysLate: latest.daysLate, feedbackCount: latest._count.feedback }
      : null,
  });

  return {
    id: m.id,
    teamId: m.teamId,
    title: m.title,
    description: m.description,
    deadline: m.deadline.toISOString(),
    createdAt: m.createdAt.toISOString(),
    createdBy: m.createdBy,
    status,
  };
}

// Record scope (BR-01, BR-02): the team filter a user is allowed to see.
export function scopeFilter(user: AuthenticatedUser): Prisma.TeamWhereInput {
  return user.role === "STUDENT"
    ? { memberships: { some: { studentId: user.id } } }
    : { supervisorAssignments: { some: { supervisorId: user.id } } };
}

// Out-of-scope and missing teams look the same to the caller (404, no disclosure).
async function findTeamInScope(user: AuthenticatedUser, teamId: number) {
  const team = await getPrisma().team.findFirst({
    where: { id: teamId, ...scopeFilter(user) },
    include: teamInclude,
  });
  if (!team) throw notFound();
  return team;
}

export async function listTeams(user: AuthenticatedUser) {
  const teams = await getPrisma().team.findMany({
    where: scopeFilter(user),
    include: teamInclude,
    orderBy: { name: "asc" },
  });
  return teams.map(toTeamDto);
}

export async function getTeam(user: AuthenticatedUser, teamId: number) {
  return toTeamDto(await findTeamInScope(user, teamId));
}

export async function listMilestones(user: AuthenticatedUser, teamId: number) {
  await findTeamInScope(user, teamId);
  const milestones = await getPrisma().milestone.findMany({
    where: { teamId },
    include: milestoneInclude,
    orderBy: [{ deadline: "asc" }, { id: "asc" }],
  });
  const now = new Date();
  return milestones.map((m) => toMilestoneDto(m, now));
}

// Role is checked by requireRole("SUPERVISOR") on the route; scope is checked here, before validation.
export async function createMilestone(user: AuthenticatedUser, teamId: number, body: unknown) {
  await findTeamInScope(user, teamId);
  const input = validateMilestoneInput(body, new Date());
  const milestone = await getPrisma().milestone.create({
    data: { ...input, teamId, createdById: user.id },
    include: milestoneInclude,
  });
  return toMilestoneDto(milestone);
}

// F-06 (FR-11): the same milestone for several assigned teams, all or nothing. Role is checked by
// requireRole("SUPERVISOR"). The team list is read first (400), then every team must be in scope (404, no
// disclosure of which one failed), then the milestone fields (400). All rows are created in one transaction.
export async function createMilestoneForTeams(user: AuthenticatedUser, body: unknown) {
  const teamIds = validateTeamIds(body);
  // An ID above INT4 is an unknown team (404). Prisma throws on such a value, so decide before the query (#89).
  if (teamIds.some((id) => id > PG_INT4_MAX)) throw notFound();
  const inScope = await getPrisma().team.count({ where: { id: { in: teamIds }, ...scopeFilter(user) } });
  if (inScope !== teamIds.length) throw notFound();

  const input = validateMilestoneInput(body, new Date());
  const prisma = getPrisma();
  const created = await prisma.$transaction(
    teamIds.map((teamId) =>
      prisma.milestone.create({ data: { ...input, teamId, createdById: user.id }, include: milestoneInclude })
    )
  );
  const now = new Date();
  return created.map((m) => toMilestoneDto(m, now));
}

export async function getMilestone(user: AuthenticatedUser, milestoneId: number) {
  const milestone = await getPrisma().milestone.findFirst({
    where: { id: milestoneId, team: scopeFilter(user) },
    include: milestoneInclude,
  });
  if (!milestone) throw notFound();
  return toMilestoneDto(milestone);
}

// F-05 (FR-10, BR-13). Role is checked by requireRole("SUPERVISOR"); scope (404) before validation (400)
// before the business rule (409). The deadline rule sits in the same UPDATE statement, so concurrent edits
// can never move the deadline earlier than one already accepted, and a rejected request changes nothing.
export async function updateMilestone(user: AuthenticatedUser, milestoneId: number, body: unknown) {
  const existing = await getPrisma().milestone.findFirst({
    where: { id: milestoneId, team: scopeFilter(user) },
    select: { id: true },
  });
  if (!existing) throw notFound();

  const update = validateMilestoneUpdate(body);
  const where: Prisma.MilestoneWhereInput = { id: milestoneId };
  if (update.deadline) where.deadline = { lte: update.deadline };

  const { count } = await getPrisma().milestone.updateMany({ where, data: update });
  if (count === 0) {
    throw new HttpError(409, "DEADLINE_NOT_EXTENDED", "The deadline can only be extended, not moved earlier");
  }

  const milestone = await getPrisma().milestone.findUniqueOrThrow({ where: { id: milestoneId }, include: milestoneInclude });
  return toMilestoneDto(milestone);
}

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

const teamNameExistsError = () =>
  new HttpError(409, "TEAM_NAME_EXISTS", "A team with this name already exists");

const studentAlreadyInTeamError = () =>
  new HttpError(409, "STUDENT_ALREADY_IN_TEAM", "Student already belongs to a team");

// F-13 (FR-07): supervisor creates a team and automatically becomes an assigned supervisor (D-04, D-06).
// Uses pg_advisory_xact_lock + exact lower(name) comparison so '_', '%' and '\' stay literal and
// concurrent case-variant creates cannot both commit.
export async function createTeam(user: AuthenticatedUser, body: unknown) {
  const name = validateTeamName(body);

  return await getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(lower(${name})))`;
    const dup = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Team" WHERE lower(name) = lower(${name}) LIMIT 1
    `;
    if (dup.length > 0) throw teamNameExistsError();

    try {
      const team = await tx.team.create({
        data: {
          name,
          supervisorAssignments: { create: { supervisorId: user.id } },
        },
        include: teamInclude,
      });
      return toTeamDto(team);
    } catch (err) {
      if (isUniqueViolation(err)) throw teamNameExistsError();
      throw err;
    }
  });
}

// F-13: list unassigned students for the supervisor picker without disclosing other teams' data.
export async function listAvailableStudents() {
  return getPrisma().user.findMany({
    where: { role: "STUDENT", memberships: { none: {} } },
    select: personSelect,
    orderBy: { name: "asc" },
  });
}

// F-13 (FR-07, BR-10): scope (404) -> validation (400) -> user lookup (404 / 400 non-student) -> unique membership (409).
export async function addTeamMember(user: AuthenticatedUser, teamId: number, body: unknown) {
  await findTeamInScope(user, teamId);
  const studentId = validateAddMemberInput(body);
  if (studentId > PG_INT4_MAX) throw new HttpError(404, "NOT_FOUND", "Student not found");
  const prisma = getPrisma();

  const targetUser = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true },
  });
  if (!targetUser) throw new HttpError(404, "NOT_FOUND", "Student not found");
  if (targetUser.role !== "STUDENT") {
    throw new HttpError(400, "VALIDATION_ERROR", "Only students can be added to a team", {
      studentId: "NOT_A_STUDENT",
    });
  }

  const existingMembership = await prisma.teamMembership.findUnique({
    where: { studentId },
    select: { id: true },
  });
  if (existingMembership) throw studentAlreadyInTeamError();

  try {
    await prisma.teamMembership.create({ data: { teamId, studentId } });
  } catch (err) {
    if (isUniqueViolation(err)) throw studentAlreadyInTeamError();
    throw err;
  }

  return toTeamDto(await findTeamInScope(user, teamId));
}

// F-13 (FR-07, BR-14): deletes only TeamMembership; earlier submissions retain original submittedById.
export async function removeTeamMember(user: AuthenticatedUser, teamId: number, studentId: number) {
  await findTeamInScope(user, teamId);
  const { count } = await getPrisma().teamMembership.deleteMany({
    where: { teamId, studentId },
  });
  if (count === 0) throw notFound();
  return toTeamDto(await findTeamInScope(user, teamId));
}
