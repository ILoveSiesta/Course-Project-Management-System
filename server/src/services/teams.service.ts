import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AuthenticatedUser } from "../middleware/auth.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { validateMilestoneInput, validateMilestoneUpdate, validateTeamIds } from "../utils/validation.js";

const personSelect = { id: true, name: true, email: true } as const;

const teamInclude = {
  memberships: { include: { student: { select: personSelect } } },
  supervisorAssignments: { include: { supervisor: { select: personSelect } } },
} satisfies Prisma.TeamInclude;

const milestoneInclude = {
  createdBy: { select: { id: true, name: true } },
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

function toMilestoneDto(m: MilestoneWithCreator) {
  return {
    id: m.id,
    teamId: m.teamId,
    title: m.title,
    description: m.description,
    deadline: m.deadline.toISOString(),
    createdAt: m.createdAt.toISOString(),
    createdBy: m.createdBy,
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
  return milestones.map(toMilestoneDto);
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
  const inScope = await getPrisma().team.count({ where: { id: { in: teamIds }, ...scopeFilter(user) } });
  if (inScope !== teamIds.length) throw notFound();

  const input = validateMilestoneInput(body, new Date());
  const prisma = getPrisma();
  const created = await prisma.$transaction(
    teamIds.map((teamId) =>
      prisma.milestone.create({ data: { ...input, teamId, createdById: user.id }, include: milestoneInclude })
    )
  );
  return created.map(toMilestoneDto);
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
