import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;

const tokens: Record<string, string> = {};
const teamIds: Record<string, number> = {};

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

function inDays(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString();
}

describe("F-03 Student Submits Milestone Work and Views Submissions API", () => {
  let alphaMilestoneId: number;
  let pastMilestoneId: number;
  const createdMilestoneIds: number[] = [];

  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "student3", "supervisor1", "supervisor2"]) {
      tokens[name] = await login(`${name}@cpms.test`);
    }
    for (const team of await getPrisma().team.findMany()) {
      teamIds[team.name] = team.id;
    }

    // Create milestones on Team Alpha (supervised by supervisor1, members student1, student2)
    const mAlpha = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: "M1 Architecture", deadline: inDays(7) });
    alphaMilestoneId = mAlpha.body.milestone.id;
    createdMilestoneIds.push(alphaMilestoneId);

    // Create a milestone with past deadline directly in DB to test late submissions
    const mPast = await getPrisma().milestone.create({
      data: {
        teamId: teamIds["Team Alpha"],
        title: "M0 Inception",
        deadline: new Date(Date.now() - 2 * DAY), // 2 days ago
        createdById: (await getPrisma().user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } })).id,
      },
    });
    pastMilestoneId = mPast.id;
    createdMilestoneIds.push(pastMilestoneId);
  });

  afterAll(async () => {
    try {
      if (createdMilestoneIds.length > 0) {
        await getPrisma().submission.deleteMany({
          where: { milestoneId: { in: createdMilestoneIds } },
        });
        await getPrisma().milestone.deleteMany({
          where: { id: { in: createdMilestoneIds } },
        });
      }
    } catch {
      // Ignore if table not created yet in red phase
    }
  });

  describe("POST /api/milestones/:milestoneId/submissions", () => {
    it("TEST-03-01: student submits valid work for own team milestone (version 1, on-time)", async () => {
      const res = await request(app)
        .post(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({
          title: "Architecture Document v1",
          description: "Initial draft submitted on time",
          link: "https://github.com/alpha-team/project/pull/1",
        });

      expect(res.status).toBe(201);
      expect(res.body.submission).toMatchObject({
        milestoneId: alphaMilestoneId,
        version: 1,
        title: "Architecture Document v1",
        description: "Initial draft submitted on time",
        link: "https://github.com/alpha-team/project/pull/1",
        daysLate: 0,
      });
      expect(res.body.submission.submittedBy.name).toBe("Student One");

      // Verify in DB
      const dbSub = await getPrisma().submission.findUnique({
        where: { milestoneId_version: { milestoneId: alphaMilestoneId, version: 1 } },
      });
      expect(dbSub).toBeTruthy();
      expect(dbSub!.daysLate).toBe(0);
    });

    it("TEST-03-02: student resubmits for same milestone (version 2, version 1 untouched)", async () => {
      const v1Before = await getPrisma().submission.findUnique({
        where: { milestoneId_version: { milestoneId: alphaMilestoneId, version: 1 } },
      });

      const res = await request(app)
        .post(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({
          title: "Architecture Document v2",
          description: "Updated diagrams",
          link: "https://github.com/alpha-team/project/pull/2",
        });

      expect(res.status).toBe(201);
      expect(res.body.submission.version).toBe(2);
      expect(res.body.submission.title).toBe("Architecture Document v2");

      const v1After = await getPrisma().submission.findUnique({
        where: { milestoneId_version: { milestoneId: alphaMilestoneId, version: 1 } },
      });
      expect(v1After!.title).toBe(v1Before!.title);
      expect(v1After!.link).toBe(v1Before!.link);
    });

    it("TEST-03-03: max 3 versions per milestone; 4th submission rejected with 409", async () => {
      // 3rd submission
      const res3 = await request(app)
        .post(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({
          title: "Architecture Document v3",
          link: "https://github.com/alpha-team/project/pull/3",
        });
      expect(res3.status).toBe(201);
      expect(res3.body.submission.version).toBe(3);

      // 4th submission should be rejected
      const res4 = await request(app)
        .post(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({
          title: "Architecture Document v4",
          link: "https://github.com/alpha-team/project/pull/4",
        });

      expect(res4.status).toBe(409);
      expect(res4.body.error.code).toBe("VERSION_LIMIT_REACHED");

      const count = await getPrisma().submission.count({
        where: { milestoneId: alphaMilestoneId },
      });
      expect(count).toBe(3);
    });

    it("TEST-03-05: late submission records daysLate > 0 (BR-05)", async () => {
      const res = await request(app)
        .post(`/api/milestones/${pastMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({
          title: "Late Inception Report",
          link: "https://github.com/alpha-team/project/pull/0",
        });

      expect(res.status).toBe(201);
      expect(res.body.submission.daysLate).toBeGreaterThanOrEqual(1);
    });

    it("TEST-03-09: student of another team gets 404 NOT_FOUND", async () => {
      const countBefore = await getPrisma().submission.count({
        where: { milestoneId: alphaMilestoneId },
      });

      const res = await request(app)
        .post(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student3}`) // Team Beta student
        .send({
          title: "Cross-team submission attempt",
          link: "https://github.com/evil/project",
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");

      const countAfter = await getPrisma().submission.count({
        where: { milestoneId: alphaMilestoneId },
      });
      expect(countAfter).toBe(countBefore);
    });

    it("TEST-03-10: supervisor gets 403 FORBIDDEN (student-only operation, BR-03)", async () => {
      const countBefore = await getPrisma().submission.count({
        where: { milestoneId: alphaMilestoneId },
      });

      const res = await request(app)
        .post(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .send({
          title: "Supervisor submitting",
          link: "https://example.com/sub",
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");

      const countAfter = await getPrisma().submission.count({
        where: { milestoneId: alphaMilestoneId },
      });
      expect(countAfter).toBe(countBefore);
    });

    it("TEST-03-11: invalid fields return 400 VALIDATION_ERROR with details (BR-08)", async () => {
      // Create a fresh milestone for validation tests
      const mVal = await request(app)
        .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .send({ title: "Validation Test Milestone", deadline: inDays(10) });
      const mValId = mVal.body.milestone.id;
      createdMilestoneIds.push(mValId);

      // 1. Missing title and link
      const res1 = await request(app)
        .post(`/api/milestones/${mValId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({});
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe("VALIDATION_ERROR");
      expect(res1.body.error.details).toHaveProperty("title", "REQUIRED");
      expect(res1.body.error.details).toHaveProperty("link", "REQUIRED");

      // 2. Invalid link protocol
      const res2 = await request(app)
        .post(`/api/milestones/${mValId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({ title: "Report", link: "ftp://example.com/file" });
      expect(res2.status).toBe(400);
      expect(res2.body.error.details).toHaveProperty("link", "INVALID_URL");

      // 3. Excessively long title
      const res3 = await request(app)
        .post(`/api/milestones/${mValId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({ title: "x".repeat(121), link: "https://example.com" });
      expect(res3.status).toBe(400);
      expect(res3.body.error.details).toHaveProperty("title", "TOO_LONG");
    });
  });

  describe("GET /api/milestones/:milestoneId/submissions", () => {
    it("TEST-03-06: student views own team's submissions ordered by version ascending", async () => {
      const res = await request(app)
        .get(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.submissions)).toBe(true);
      expect(res.body.submissions).toHaveLength(3);
      expect(res.body.submissions.map((s: any) => s.version)).toEqual([1, 2, 3]);
    });

    it("TEST-03-07: assigned supervisor views submissions with submitter details", async () => {
      const res = await request(app)
        .get(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`);

      expect(res.status).toBe(200);
      expect(res.body.submissions).toHaveLength(3);
      expect(res.body.submissions[0].submittedBy).toHaveProperty("name", "Student One");
    });

    it("TEST-03-08: out-of-scope student and unassigned supervisor get 404 NOT_FOUND", async () => {
      const resStudent = await request(app)
        .get(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student3}`);
      expect(resStudent.status).toBe(404);
      expect(resStudent.body.error.code).toBe("NOT_FOUND");

      const resSup = await request(app)
        .get(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.supervisor2}`);
      expect(resSup.status).toBe(404);
      expect(resSup.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /api/submissions/:submissionId", () => {
    it("returns 200 for in-scope user and 404 for out-of-scope user", async () => {
      const list = await request(app)
        .get(`/api/milestones/${alphaMilestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`);
      const subId = list.body.submissions[0].id;

      // In-scope student
      const resOk = await request(app)
        .get(`/api/submissions/${subId}`)
        .set("Authorization", `Bearer ${tokens.student1}`);
      expect(resOk.status).toBe(200);
      expect(resOk.body.submission.id).toBe(subId);

      // In-scope supervisor
      const resSup = await request(app)
        .get(`/api/submissions/${subId}`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`);
      expect(resSup.status).toBe(200);

      // Out-of-scope student
      const resOther = await request(app)
        .get(`/api/submissions/${subId}`)
        .set("Authorization", `Bearer ${tokens.student3}`);
      expect(resOther.status).toBe(404);

      // Invalid ID
      const resInvalid = await request(app)
        .get("/api/submissions/not-a-number")
        .set("Authorization", `Bearer ${tokens.student1}`);
      expect(resInvalid.status).toBe(404);
    });
  });

  describe("TEST-03-13: 401 UNAUTHENTICATED on all endpoints without token", () => {
    it("rejects unauthenticated requests", async () => {
      const getSubs = await request(app).get(`/api/milestones/${alphaMilestoneId}/submissions`);
      expect(getSubs.status).toBe(401);

      const postSub = await request(app)
        .post(`/api/milestones/${alphaMilestoneId}/submissions`)
        .send({ title: "No token", link: "https://example.com" });
      expect(postSub.status).toBe(401);

      const getOne = await request(app).get("/api/submissions/1");
      expect(getOne.status).toBe(401);
    });
  });

  describe("TEST-03-14: Concurrency (NFR-06)", () => {
    it("handles 10 concurrent submission requests safely: exactly 3 succeed, 7 get 409", async () => {
      // Create a fresh milestone for Team Beta
      const mBeta = await request(app)
        .post(`/api/teams/${teamIds["Team Beta"]}/milestones`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        .send({ title: "Concurrent Submission Milestone", deadline: inDays(5) });
      const mBetaId = mBeta.body.milestone.id;
      createdMilestoneIds.push(mBetaId);

      // Fire 10 parallel submissions by student3
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post(`/api/milestones/${mBetaId}/submissions`)
          .set("Authorization", `Bearer ${tokens.student3}`)
          .send({
            title: `Concurrent Attempt #${i + 1}`,
            link: `https://example.com/attempt-${i + 1}`,
          })
      );

      const responses = await Promise.all(promises);
      const successes = responses.filter((r) => r.status === 201);
      const limitReached = responses.filter((r) => r.status === 409);

      expect(successes).toHaveLength(3);
      expect(limitReached).toHaveLength(7);

      const versions = successes.map((r) => r.body.submission.version).sort((a, b) => a - b);
      expect(versions).toEqual([1, 2, 3]);

      const count = await getPrisma().submission.count({
        where: { milestoneId: mBetaId },
      });
      expect(count).toBe(3);
    });
  });
});
