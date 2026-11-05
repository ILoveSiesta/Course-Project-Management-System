import { Prisma } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AuthenticatedUser } from "../middleware/auth.js";
import { notFound } from "../utils/httpError.js";
import { validateMilestoneInput } from "../utils/validation.js";

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
function scopeFilter(user: AuthenticatedUser): Prisma.TeamWhereInput {
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

export async function getMilestone(user: AuthenticatedUser, milestoneId: number) {
  const milestone = await getPrisma().milestone.findFirst({
    where: { id: milestoneId, team: scopeFilter(user) },
    include: milestoneInclude,
  });
  if (!milestone) throw notFound();
  return toMilestoneDto(milestone);
}
