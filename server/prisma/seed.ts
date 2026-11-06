import "../src/utils/env.js";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function seed() {
  const defaultPassword = process.env.SEED_DEMO_PASSWORD || "demo-password";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Create or upsert users
  const studentsData = [
    { email: "student1@cpms.test", name: "Student One", role: Role.STUDENT },
    { email: "student2@cpms.test", name: "Student Two", role: Role.STUDENT },
    { email: "student3@cpms.test", name: "Student Three", role: Role.STUDENT },
    { email: "student4@cpms.test", name: "Student Four", role: Role.STUDENT },
    { email: "student5@cpms.test", name: "Student Five", role: Role.STUDENT },
    { email: "student6@cpms.test", name: "Student Six", role: Role.STUDENT },
  ];

  const supervisorsData = [
    { email: "supervisor1@cpms.test", name: "Supervisor One", role: Role.SUPERVISOR },
    { email: "supervisor2@cpms.test", name: "Supervisor Two", role: Role.SUPERVISOR },
  ];

  const users: Record<string, any> = {};

  for (const s of [...studentsData, ...supervisorsData]) {
    users[s.email] = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name, role: s.role, passwordHash },
      create: { email: s.email, name: s.name, role: s.role, passwordHash },
    });
  }

  // 2. Create or upsert teams
  const teamNames = ["Team Alpha", "Team Beta", "Team Gamma"];
  const teams: Record<string, any> = {};

  for (const name of teamNames) {
    teams[name] = await prisma.team.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 3. Team Memberships (student belongs to at most one team)
  const memberships = [
    { team: "Team Alpha", studentEmail: "student1@cpms.test" },
    { team: "Team Alpha", studentEmail: "student2@cpms.test" },
    { team: "Team Beta", studentEmail: "student3@cpms.test" },
    { team: "Team Beta", studentEmail: "student4@cpms.test" },
    { team: "Team Gamma", studentEmail: "student5@cpms.test" },
    { team: "Team Gamma", studentEmail: "student6@cpms.test" },
  ];

  for (const m of memberships) {
    const student = users[m.studentEmail];
    const team = teams[m.team];
    await prisma.teamMembership.upsert({
      where: { studentId: student.id },
      update: { teamId: team.id },
      create: { teamId: team.id, studentId: student.id },
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
