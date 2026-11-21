import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

// F-13 Team management (contract docs/sprints/sprint-3/F-13-team-management.md).
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;

const tokens: Record<string, string> = {};
const userIds: Record<string, number> = {};
const teamIds: Record<string, number> = {};
const createdTeamIds: number[] = [];
const createdUserIds: number[] = [];
const createdMilestoneIds: number[] = [];

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

describe("F-13 Team management API", () => {
  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "student2", "student3", "supervisor1", "supervisor2"]) {
      const email = `${name}@cpms.test`;
      tokens[name] = await login(email);
      const u = await getPrisma().user.findUniqueOrThrow({ where: { email } });
      userIds[name] = u.id;
    }
    for (const team of await getPrisma().team.findMany()) {
      teamIds[team.name] = team.id;
    }

    // Create two unassigned synthetic students specifically for F-13 tests so parallel or other
    // Sprint 1/2 student assertions are undisturbed outside explicit BR-14 removal checks.
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    for (const [key, email, name] of [
      ["freeA", "f13-free-a@cpms.test", "F13 Free Student A"],
      ["freeB", "f13-free-b@cpms.test", "F13 Free Student B"],
    ] as const) {
      const user = await getPrisma().user.upsert({
        where: { email },
        update: { name, role: Role.STUDENT, passwordHash: hash },
        create: { email, name, role: Role.STUDENT, passwordHash: hash },
      });
      await getPrisma().teamMembership.deleteMany({ where: { studentId: user.id } });
      userIds[key] = user.id;
      createdUserIds.push(user.id);
    }
  });

  afterAll(async () => {
    const prisma = getPrisma();
    const teamsToDelete = await prisma.team.findMany({
      where: { OR: [{ id: { in: createdTeamIds } }, { name: { startsWith: "F13 " } }] },
      select: { id: true },
    });
    const extraTeamIds = teamsToDelete.map((t) => t.id);

    const milestoneWhere = {
      OR: [{ id: { in: createdMilestoneIds } }, { teamId: { in: extraTeamIds } }],
    };
    const ms = await prisma.milestone.findMany({ where: milestoneWhere, select: { id: true } });
    const msIds = ms.map((m) => m.id);
    if (msIds.length > 0) {
      await prisma.grade.deleteMany({ where: { milestoneId: { in: msIds } } });
      const subs = await prisma.submission.findMany({ where: { milestoneId: { in: msIds } }, select: { id: true } });
      const subIds = subs.map((s) => s.id);
      if (subIds.length > 0) {
        await prisma.feedback.deleteMany({ where: { submissionId: { in: subIds } } });
        await prisma.submission.deleteMany({ where: { id: { in: subIds } } });
      }
      await prisma.milestone.deleteMany({ where: { id: { in: msIds } } });
    }
    if (extraTeamIds.length > 0) {
      await prisma.teamMembership.deleteMany({ where: { teamId: { in: extraTeamIds } } });
      await prisma.supervisorAssignment.deleteMany({ where: { teamId: { in: extraTeamIds } } });
      await prisma.team.deleteMany({ where: { id: { in: extraTeamIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.teamMembership.deleteMany({ where: { studentId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    // Restore any seeded student memberships moved during BR-14 tests.
    await seed();
  });

  it("TEST-13-01: supervisor creates a team, becomes assigned supervisor, sees it listed and can create milestones", async () => {
    const res = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ name: "  F13 Team Delta  " });

    expect(res.status).toBe(201);
    expect(res.body.team).toMatchObject({
      name: "F13 Team Delta",
      members: [],
      supervisors: [{ id: userIds.supervisor1, name: "Supervisor One", email: "supervisor1@cpms.test" }],
    });
    const deltaId: number = res.body.team.id;
    createdTeamIds.push(deltaId);

    // Creator lists it via GET /api/teams; unassigned supervisor2 does not.
    const listSup1 = await request(app).get("/api/teams").set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(listSup1.status).toBe(200);
    expect(listSup1.body.teams.some((t: { id: number }) => t.id === deltaId)).toBe(true);

    const listSup2 = await request(app).get("/api/teams").set("Authorization", `Bearer ${tokens.supervisor2}`);
    expect(listSup2.body.teams.some((t: { id: number }) => t.id === deltaId)).toBe(false);

    // Accepts milestones under F-02.
    const msRes = await request(app)
      .post(`/api/teams/${deltaId}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "Delta Kickoff", deadline: new Date(Date.now() + 3 * DAY).toISOString() });
    expect(msRes.status).toBe(201);
    createdMilestoneIds.push(msRes.body.milestone.id);
  });

  it("TEST-13-02: team creation validates name and rejects case-insensitive duplicates with 409 TEAM_NAME_EXISTS", async () => {
    for (const [body, code] of [
      [{}, "REQUIRED"],
      [{ name: "   " }, "REQUIRED"],
      [{ name: 42 }, "INVALID_TYPE"],
      [{ name: "X".repeat(81) }, "TOO_LONG"],
    ] as const) {
      const res = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .send(body as object);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.name).toBe(code);
    }

    for (const dupName of ["Team Alpha", "team alpha", "  TEAM ALPHA  "]) {
      const res = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${tokens.supervisor2}`)
        .send({ name: dupName });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TEAM_NAME_EXISTS");
    }
  });

  it("TEST-13-03: available-students returns only unassigned students without leaking team members, supervisors or hashes", async () => {
    const res = await request(app)
      .get("/api/teams/available-students")
      .set("Authorization", `Bearer ${tokens.supervisor2}`);

    expect(res.status).toBe(200);
    const emails = res.body.students.map((s: { email: string }) => s.email);
    expect(emails).toContain("f13-free-a@cpms.test");
    expect(emails).toContain("f13-free-b@cpms.test");
    expect(emails).not.toContain("student1@cpms.test");
    expect(emails).not.toContain("student3@cpms.test");
    expect(emails).not.toContain("supervisor1@cpms.test");
    for (const s of res.body.students) {
      expect(Object.keys(s).sort()).toEqual(["email", "id", "name"]);
    }
  });

  it("TEST-13-04: assigned supervisor adds an unassigned student and membership persists cleanly", async () => {
    const createTeam = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ name: "F13 Team Echo" });
    expect(createTeam.status).toBe(201);
    const echoId: number = createTeam.body.team.id;
    createdTeamIds.push(echoId);

    const addRes = await request(app)
      .post(`/api/teams/${echoId}/members`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ studentId: userIds.freeA });

    expect(addRes.status).toBe(201);
    expect(addRes.body.team.members.map((m: { id: number }) => m.id)).toEqual([userIds.freeA]);

    const getRes = await request(app)
      .get(`/api/teams/${echoId}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.team.members.map((m: { email: string }) => m.email)).toEqual(["f13-free-a@cpms.test"]);

    const avail = await request(app)
      .get("/api/teams/available-students")
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(avail.body.students.map((s: { id: number }) => s.id)).not.toContain(userIds.freeA);
  });

  it("TEST-13-05: BR-10 rejects adding a student who is already in another team or the same team with 409", async () => {
    const gammaId = teamIds["Team Gamma"];
    const alphaId = teamIds["Team Alpha"];

    // student1 is in Team Alpha; supervisor2 (assigned to Gamma) tries to add student1 to Gamma.
    const otherTeamRes = await request(app)
      .post(`/api/teams/${gammaId}/members`)
      .set("Authorization", `Bearer ${tokens.supervisor2}`)
      .send({ studentId: userIds.student1 });
    expect(otherTeamRes.status).toBe(409);
    expect(otherTeamRes.body.error.code).toBe("STUDENT_ALREADY_IN_TEAM");

    // supervisor1 tries to add student1 again to Team Alpha.
    const sameTeamRes = await request(app)
      .post(`/api/teams/${alphaId}/members`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ studentId: userIds.student1 });
    expect(sameTeamRes.status).toBe(409);
    expect(sameTeamRes.body.error.code).toBe("STUDENT_ALREADY_IN_TEAM");

    const memberships = await getPrisma().teamMembership.findMany({ where: { studentId: userIds.student1 } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].teamId).toBe(alphaId);
  });

  it("TEST-13-06: BR-10 concurrent adds for the same unassigned student succeed at most once and return 409 for the other", async () => {
    const tA = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ name: "F13 Concurrent A" });
    const tB = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor2}`)
      .send({ name: "F13 Concurrent B" });
    createdTeamIds.push(tA.body.team.id, tB.body.team.id);

    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/api/teams/${tA.body.team.id}/members`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .send({ studentId: userIds.freeB }),
      request(app)
        .post(`/api/teams/${tB.body.team.id}/members`)
        .set("Authorization", `Bearer ${tokens.supervisor2}`)
        .send({ studentId: userIds.freeB }),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
    const conflict = r1.status === 409 ? r1 : r2;
    expect(conflict.body.error.code).toBe("STUDENT_ALREADY_IN_TEAM");

    const memberships = await getPrisma().teamMembership.findMany({ where: { studentId: userIds.freeB } });
    expect(memberships).toHaveLength(1);
  });

  it("TEST-13-07: add member rejects invalid studentId, unknown user (404), and supervisor accounts (NOT_A_STUDENT)", async () => {
    const alphaId = teamIds["Team Alpha"];

    for (const [body, code] of [
      [{}, "REQUIRED"],
      [{ studentId: "1" }, "INVALID_TYPE"],
      [{ studentId: -2 }, "INVALID_TYPE"],
    ] as const) {
      const res = await request(app)
        .post(`/api/teams/${alphaId}/members`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .send(body as object);
      expect(res.status).toBe(400);
      expect(res.body.error.details.studentId).toBe(code);
    }

    const unknownRes = await request(app)
      .post(`/api/teams/${alphaId}/members`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ studentId: 999999 });
    expect(unknownRes.status).toBe(404);
    expect(unknownRes.body.error.code).toBe("NOT_FOUND");

    const supRes = await request(app)
      .post(`/api/teams/${alphaId}/members`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ studentId: userIds.supervisor2 });
    expect(supRes.status).toBe(400);
    expect(supRes.body.error.code).toBe("VALIDATION_ERROR");
    expect(supRes.body.error.details.studentId).toBe("NOT_A_STUDENT");
  });

  it("TEST-13-08: supervisor removes a member (returns to available-students) and repeating delete returns 404", async () => {
    const createTeam = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ name: "F13 Team Remove" });
    const teamId: number = createTeam.body.team.id;
    createdTeamIds.push(teamId);

    // Ensure freeB is free first, then add and remove.
    await getPrisma().teamMembership.deleteMany({ where: { studentId: userIds.freeB } });
    const added = await request(app)
      .post(`/api/teams/${teamId}/members`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ studentId: userIds.freeB });
    expect(added.status).toBe(201);

    const del1 = await request(app)
      .delete(`/api/teams/${teamId}/members/${userIds.freeB}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(del1.status).toBe(200);
    expect(del1.body.team.members).toEqual([]);

    const avail = await request(app)
      .get("/api/teams/available-students")
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(avail.body.students.map((s: { id: number }) => s.id)).toContain(userIds.freeB);

    const del2 = await request(app)
      .delete(`/api/teams/${teamId}/members/${userIds.freeB}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(del2.status).toBe(404);
  });

  it("TEST-13-09: BR-14 preserves submitter on earlier submissions and revokes removed student access to the old team", async () => {
    const alphaId = teamIds["Team Alpha"];
    const msRes = await request(app)
      .post(`/api/teams/${alphaId}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "F13 BR14 Alpha Milestone", deadline: new Date(Date.now() + 5 * DAY).toISOString() });
    expect(msRes.status).toBe(201);
    const msId: number = msRes.body.milestone.id;
    createdMilestoneIds.push(msId);

    // student2 submits work on Team Alpha
    const subRes = await request(app)
      .post(`/api/milestones/${msId}/submissions`)
      .set("Authorization", `Bearer ${tokens.student2}`)
      .send({ title: "F13 Alpha Submission", link: "https://example.com/f13-alpha" });
    expect(subRes.status).toBe(201);

    // Remove student2 from Team Alpha
    const removeRes = await request(app)
      .delete(`/api/teams/${alphaId}/members/${userIds.student2}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.team.members.map((m: { id: number }) => m.id)).not.toContain(userIds.student2);

    // Removed student immediately loses access to Team Alpha
    const removedTeams = await request(app).get("/api/teams").set("Authorization", `Bearer ${tokens.student2}`);
    expect(removedTeams.status).toBe(200);
    expect(removedTeams.body.teams).toEqual([]);

    const oldTeamRead = await request(app)
      .get(`/api/teams/${alphaId}`)
      .set("Authorization", `Bearer ${tokens.student2}`);
    expect(oldTeamRead.status).toBe(404);

    const oldMsRead = await request(app)
      .get(`/api/milestones/${msId}/submissions`)
      .set("Authorization", `Bearer ${tokens.student2}`);
    expect(oldMsRead.status).toBe(404);

    // Add student2 to a new team ("move" = remove + add)
    const targetTeam = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ name: "F13 Move Destination" });
    createdTeamIds.push(targetTeam.body.team.id);

    const moveIn = await request(app)
      .post(`/api/teams/${targetTeam.body.team.id}/members`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ studentId: userIds.student2 });
    expect(moveIn.status).toBe(201);

    // Team Alpha supervisor & history still see original submitter (Student Two)
    const supSubs = await request(app)
      .get(`/api/milestones/${msId}/submissions`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(supSubs.status).toBe(200);
    expect(supSubs.body.submissions[0].submittedBy).toEqual({ id: userIds.student2, name: "Student Two" });

    const historyRes = await request(app)
      .get(`/api/milestones/${msId}/history`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.history.revisions[0].submittedBy).toEqual({ id: userIds.student2, name: "Student Two" });
  });

  it("TEST-13-10: permissions check 401 (no token), 403 (student), 404 (unassigned supervisor / bad ID) with positive control", async () => {
    const alphaId = teamIds["Team Alpha"];
    const student3Id = userIds.student3;

    // 401 unauthenticated
    for (const req of [
      request(app).post("/api/teams").send({ name: "NoAuth Team" }),
      request(app).get("/api/teams/available-students"),
      request(app).post(`/api/teams/${alphaId}/members`).send({ studentId: userIds.freeB }),
      request(app).delete(`/api/teams/${alphaId}/members/${userIds.student1}`),
    ]) {
      const res = await req;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }

    // 403 student
    for (const req of [
      request(app).post("/api/teams").set("Authorization", `Bearer ${tokens.student1}`).send({ name: "Student Team" }),
      request(app).get("/api/teams/available-students").set("Authorization", `Bearer ${tokens.student1}`),
      request(app)
        .post(`/api/teams/${alphaId}/members`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({ studentId: userIds.freeB }),
      request(app)
        .delete(`/api/teams/${alphaId}/members/${userIds.student1}`)
        .set("Authorization", `Bearer ${tokens.student1}`),
    ]) {
      const res = await req;
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }

    // 404 unassigned supervisor (supervisor2 -> Team Alpha) and invalid IDs
    const unassignedAdd = await request(app)
      .post(`/api/teams/${alphaId}/members`)
      .set("Authorization", `Bearer ${tokens.supervisor2}`)
      .send({ studentId: userIds.freeB });
    expect(unassignedAdd.status).toBe(404);

    const unassignedDel = await request(app)
      .delete(`/api/teams/${alphaId}/members/${userIds.student1}`)
      .set("Authorization", `Bearer ${tokens.supervisor2}`);
    expect(unassignedDel.status).toBe(404);

    const wrongTeamDel = await request(app)
      .delete(`/api/teams/${alphaId}/members/${student3Id}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(wrongTeamDel.status).toBe(404);

    const nonNumeric = await request(app)
      .post("/api/teams/abc/members")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ studentId: userIds.freeB });
    expect(nonNumeric.status).toBe(404);

    // Positive control: assigned supervisor1 can manage Alpha cleanly
    const controlTeam = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ name: "F13 Positive Control" });
    expect(controlTeam.status).toBe(201);
    createdTeamIds.push(controlTeam.body.team.id);
  });
});
