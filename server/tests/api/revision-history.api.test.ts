import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

// F-07 Milestone Revision History (contract docs/sprints/sprint-2/F-07-revision-history.md).

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;
const PREFIX = "F07-";

const tokens: Record<string, string> = {};
const teamIds: Record<string, number> = {};
let supervisor1Id: number;
let student1Id: number;

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

describe("F-07 Milestone Revision History API", () => {
  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "student3", "supervisor1", "supervisor2"]) {
      tokens[name] = await login(`${name}@cpms.test`);
    }
    for (const team of await getPrisma().team.findMany()) {
      teamIds[team.name] = team.id;
    }
    supervisor1Id = (await getPrisma().user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } })).id;
    student1Id = (await getPrisma().user.findUniqueOrThrow({ where: { email: "student1@cpms.test" } })).id;
  });

  afterAll(async () => {
    await getPrisma().feedback.deleteMany({ where: { submission: { milestone: { title: { startsWith: PREFIX } } } } });
    await getPrisma().submission.deleteMany({ where: { milestone: { title: { startsWith: PREFIX } } } });
    await getPrisma().milestone.deleteMany({ where: { title: { startsWith: PREFIX } } });
  });

  async function createAlphaMilestone(title: string, deadline = new Date(Date.now() + 7 * DAY)) {
    return getPrisma().milestone.create({
      data: {
        teamId: teamIds["Team Alpha"],
        title: `${PREFIX}${title}`,
        description: "Revision history test",
        deadline,
        createdById: supervisor1Id,
      },
    });
  }

  function fetchHistory(milestoneId: number | string, token: string | undefined, query = "") {
    const req = request(app).get(`/api/milestones/${milestoneId}/history${query}`);
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req;
  }

  it("TEST-07-01: returns full revision history for student and assigned supervisor with desc/asc ordering", async () => {
    const deadline = new Date(Date.now() + 7 * DAY);
    const m = await createAlphaMilestone("Two versions", deadline);

    const v1 = await getPrisma().submission.create({
      data: {
        milestoneId: m.id,
        submittedById: student1Id,
        version: 1,
        title: "Draft v1",
        description: "Initial",
        link: "https://example.com/v1",
        submittedAt: new Date(deadline.getTime() - DAY),
        daysLate: 0,
      },
    });
    await getPrisma().feedback.create({
      data: {
        submissionId: v1.id,
        authorId: supervisor1Id,
        comment: "First feedback",
        createdAt: new Date(deadline.getTime() - 12 * 60 * 60 * 1000),
      },
    });
    await getPrisma().feedback.create({
      data: {
        submissionId: v1.id,
        authorId: supervisor1Id,
        comment: "Second feedback",
        createdAt: new Date(deadline.getTime() - 6 * 60 * 60 * 1000),
      },
    });

    await getPrisma().submission.create({
      data: {
        milestoneId: m.id,
        submittedById: student1Id,
        version: 2,
        title: "Draft v2",
        description: null,
        link: "https://example.com/v2",
        submittedAt: new Date(deadline.getTime() + 1000),
        daysLate: 1,
      },
    });

    const asStudent = await fetchHistory(m.id, tokens.student1);
    expect(asStudent.status).toBe(200);
    expect(asStudent.body.history).toMatchObject({
      milestone: {
        id: m.id,
        teamId: teamIds["Team Alpha"],
        teamName: "Team Alpha",
        title: `${PREFIX}Two versions`,
      },
      totalVersions: 2,
      latestVersion: 2,
    });
    expect(asStudent.body.history.revisions.map((r: { version: number }) => r.version)).toEqual([2, 1]);
    expect(asStudent.body.history.revisions[0]).toMatchObject({
      version: 2,
      isLatest: true,
      title: "Draft v2",
      daysLate: 1,
      isLate: true,
      feedbackCount: 0,
      feedback: [],
      submittedBy: { id: student1Id, name: "Student One" },
    });
    expect(asStudent.body.history.revisions[1]).toMatchObject({
      version: 1,
      isLatest: false,
      title: "Draft v1",
      daysLate: 0,
      isLate: false,
      feedbackCount: 2,
    });
    expect(asStudent.body.history.revisions[1].feedback.map((f: { comment: string }) => f.comment)).toEqual([
      "First feedback",
      "Second feedback",
    ]);
    expect(asStudent.body.history.revisions[1].feedback[0].author).toEqual({
      id: supervisor1Id,
      name: "Supervisor One",
    });

    const asSupervisorAsc = await fetchHistory(m.id, tokens.supervisor1, "?order=asc");
    expect(asSupervisorAsc.status).toBe(200);
    expect(asSupervisorAsc.body.history.revisions.map((r: { version: number }) => r.version)).toEqual([1, 2]);
  });

  it("TEST-07-02: preserves earlier versions and their feedback across resubmissions (BR-06, BR-09)", async () => {
    const m = await createAlphaMilestone("Immutability");

    const s1 = await request(app)
      .post(`/api/milestones/${m.id}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "Work v1", description: "D1", link: "https://example.com/1" });
    expect(s1.status).toBe(201);

    const fb1 = await request(app)
      .post(`/api/submissions/${s1.body.submission.id}/feedback`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ comment: "Feedback on v1" });
    expect(fb1.status).toBe(201);

    const s2 = await request(app)
      .post(`/api/milestones/${m.id}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "Work v2", description: "D2", link: "https://example.com/2" });
    expect(s2.status).toBe(201);

    const fb2 = await request(app)
      .post(`/api/submissions/${s2.body.submission.id}/feedback`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ comment: "Feedback on v2" });
    expect(fb2.status).toBe(201);

    const s3 = await request(app)
      .post(`/api/milestones/${m.id}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "Work v3", link: "https://example.com/3" });
    expect(s3.status).toBe(201);

    const res = await fetchHistory(m.id, tokens.student1, "?order=asc");
    expect(res.status).toBe(200);
    expect(res.body.history.totalVersions).toBe(3);
    expect(res.body.history.latestVersion).toBe(3);

    const [r1, r2, r3] = res.body.history.revisions;
    expect(r1).toMatchObject({ version: 1, title: "Work v1", link: "https://example.com/1", isLatest: false });
    expect(r1.feedback.map((f: { comment: string }) => f.comment)).toEqual(["Feedback on v1"]);
    expect(r2).toMatchObject({ version: 2, title: "Work v2", link: "https://example.com/2", isLatest: false });
    expect(r2.feedback.map((f: { comment: string }) => f.comment)).toEqual(["Feedback on v2"]);
    expect(r3).toMatchObject({ version: 3, title: "Work v3", link: "https://example.com/3", isLatest: true, feedback: [] });
  });

  it("TEST-07-03: returns empty revisions array and null latestVersion when milestone has no submissions", async () => {
    const m = await createAlphaMilestone("Empty");

    const res = await fetchHistory(m.id, tokens.student1);
    expect(res.status).toBe(200);
    expect(res.body.history).toMatchObject({
      milestone: { id: m.id, teamName: "Team Alpha", title: `${PREFIX}Empty` },
      totalVersions: 0,
      latestVersion: null,
      revisions: [],
    });
  });

  it("TEST-07-04: rejects out-of-scope, unknown, non-numeric with 404 and unauthenticated with 401", async () => {
    const m = await createAlphaMilestone("Scope");

    const otherStudent = await fetchHistory(m.id, tokens.student3);
    expect(otherStudent.status).toBe(404);
    expect(otherStudent.body.error.code).toBe("NOT_FOUND");
    expect(otherStudent.body.history).toBeUndefined();

    const unassignedSup = await fetchHistory(m.id, tokens.supervisor2);
    expect(unassignedSup.status).toBe(404);
    expect(unassignedSup.body.error.code).toBe("NOT_FOUND");
    expect(unassignedSup.body.history).toBeUndefined();

    const unknownId = await fetchHistory(999999, tokens.student1);
    expect(unknownId.status).toBe(404);
    expect(unknownId.body.error.code).toBe("NOT_FOUND");

    const nonNumeric = await fetchHistory("abc", tokens.student1);
    expect(nonNumeric.status).toBe(404);
    expect(nonNumeric.body.error.code).toBe("NOT_FOUND");

    const noToken = await fetchHistory(m.id, undefined);
    expect(noToken.status).toBe(401);
    expect(noToken.body.error.code).toBe("UNAUTHENTICATED");

    // Positive controls: student1 and assigned supervisor1 succeed
    expect((await fetchHistory(m.id, tokens.student1)).status).toBe(200);
    expect((await fetchHistory(m.id, tokens.supervisor1)).status).toBe(200);
  });

  it("TEST-07-05: invalid order returns 400 in scope and 404 out of scope (scope checked first)", async () => {
    const m = await createAlphaMilestone("Order validation");

    const invalid = await fetchHistory(m.id, tokens.student1, "?order=invalid");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    expect(invalid.body.error.details).toEqual({ order: "INVALID_ORDER" });

    const emptyOrder = await fetchHistory(m.id, tokens.student1, "?order=");
    expect(emptyOrder.status).toBe(400);
    expect(emptyOrder.body.error.details).toEqual({ order: "INVALID_ORDER" });

    // Out of scope must return 404 even when order is invalid
    const outOfScopeInvalid = await fetchHistory(m.id, tokens.student3, "?order=invalid");
    expect(outOfScopeInvalid.status).toBe(404);
    expect(outOfScopeInvalid.body.error.code).toBe("NOT_FOUND");

    // Positive control
    const valid = await fetchHistory(m.id, tokens.student1, "?order=asc");
    expect(valid.status).toBe(200);
  });
});
