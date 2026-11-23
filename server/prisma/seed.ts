import "../src/utils/env.js";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Demo-account passwords come only from the environment (local .env, CI, or Secret Manager
// on GCP); there is no fallback in code (Lab 5 #18).
export function demoPasswordFrom(env: Record<string, string | undefined>): string {
  const value = env.SEED_DEMO_PASSWORD;
  if (!value || !value.trim()) {
    throw new Error("SEED_DEMO_PASSWORD is not set: refusing to seed demo accounts without a password from the environment.");
  }
  return value;
}

export async function seed() {
  const passwordHash = await bcrypt.hash(demoPasswordFrom(process.env), 10);

  // 1. Create or upsert baseline teams first so student creation can link baseline memberships.
  const teamNames = ["Team Alpha", "Team Beta", "Team Gamma"];
  const teams: Record<string, any> = {};

  for (const name of teamNames) {
    teams[name] = await prisma.team.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 2. Create or upsert users.
  // Baseline team memberships are created ONLY when the student account is first created so
  // supervisor-managed moves and removals (F-13, AC-13-12) survive cpms-migrate re-runs on deploy.
  const studentsData = [
    { email: "student1@cpms.test", name: "Student One", team: "Team Alpha" },
    { email: "student2@cpms.test", name: "Student Two", team: "Team Alpha" },
    { email: "student3@cpms.test", name: "Student Three", team: "Team Beta" },
    { email: "student4@cpms.test", name: "Student Four", team: "Team Beta" },
    { email: "student5@cpms.test", name: "Student Five", team: "Team Gamma" },
    { email: "student6@cpms.test", name: "Student Six", team: "Team Gamma" },
  ];

  const supervisorsData = [
    { email: "supervisor1@cpms.test", name: "Supervisor One" },
    { email: "supervisor2@cpms.test", name: "Supervisor Two" },
  ];

  const users: Record<string, any> = {};

  for (const s of studentsData) {
    users[s.email] = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, role: Role.STUDENT, passwordHash },
      create: {
        email: s.email,
        name: s.name,
        role: Role.STUDENT,
        passwordHash,
        memberships: { create: { teamId: teams[s.team].id } },
      },
    });
  }

  for (const sup of supervisorsData) {
    users[sup.email] = await prisma.user.upsert({
      where: { email: sup.email },
      update: { name: sup.name, role: Role.SUPERVISOR, passwordHash },
      create: { email: sup.email, name: sup.name, role: Role.SUPERVISOR, passwordHash },
    });
  }

  // 4. Supervisor Assignments
  // Team Alpha: supervisor1
  // Team Beta: supervisor1, supervisor2
  // Team Gamma: supervisor2
  const assignments = [
    { team: "Team Alpha", supervisorEmail: "supervisor1@cpms.test" },
    { team: "Team Beta", supervisorEmail: "supervisor1@cpms.test" },
    { team: "Team Beta", supervisorEmail: "supervisor2@cpms.test" },
    { team: "Team Gamma", supervisorEmail: "supervisor2@cpms.test" },
  ];

  for (const a of assignments) {
    const supervisor = users[a.supervisorEmail];
    const team = teams[a.team];
    await prisma.supervisorAssignment.upsert({
      where: {
        teamId_supervisorId: {
          teamId: team.id,
          supervisorId: supervisor.id,
        },
      },
      update: {},
      create: {
        teamId: team.id,
        supervisorId: supervisor.id,
      },
    });
  }

  console.log("Seed completed successfully with synthetic demo data.");
}

async function main() {
  await seed();
}

if (process.env.NODE_ENV !== "test") {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
