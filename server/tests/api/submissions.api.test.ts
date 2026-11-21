import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
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

  // CR #59 / CHG-03 (F-03 contract v0.2): late submissions accepted for at most 7 x 24 h after the deadline.
  describe("BR-05 rev. (CHG-03): 7-day late window", () => {
    const WINDOW = 7 * DAY;
    const WINDOW_CLOSED = {
      code: "SUBMISSION_WINDOW_CLOSED",
      message: "Late submissions are accepted up to 7 days after the deadline",
    };
    const validBody = { title: "Late window work", link: "https://example.com/late-window" };
    let supervisor1Id: number;
    let student1Id: number;

    beforeAll(async () => {
      supervisor1Id = (await getPrisma().user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } })).id;
      student1Id = (await getPrisma().user.findUniqueOrThrow({ where: { email: "student1@cpms.test" } })).id;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Created directly in the database because milestone creation requires a future deadline (BR-04).
    async function alphaMilestone(deadline: Date, title: string) {
      const m = await getPrisma().milestone.create({
        data: { teamId: teamIds["Team Alpha"], title, deadline, createdById: supervisor1Id },
      });
      createdMilestoneIds.push(m.id);
      return m;
    }

    // A version stored directly, as data that existed before the change.
    function storedVersion(milestoneId: number, version: number, submittedAt: Date, daysLate: number) {
      return getPrisma().submission.create({
        data: {
          milestoneId,
          submittedById: student1Id,
          version,
          title: `Stored version ${version}`,
          link: `https://example.com/stored-${version}`,
          submittedAt,
          daysLate,
        },
      });
    }

    function submit(milestoneId: number, token: string | undefined, body: object = validBody) {
      const req = request(app).post(`/api/milestones/${milestoneId}/submissions`);
      if (token) req.set("Authorization", `Bearer ${token}`);
      return req.send(body);
    }

    const countOf = (milestoneId: number) => getPrisma().submission.count({ where: { milestoneId } });

    it("TEST-03-19: accepted at exactly deadline + 7 days (daysLate 7), rejected 1 ms later with nothing stored", async () => {
      const realNow = Date.now();
      const deadline = new Date(realNow - WINDOW);
      const m = await alphaMilestone(deadline, "CHG-03 boundary");

      // Only Date is faked; timers used by Supertest and Prisma keep running.
      vi.useFakeTimers({ toFake: ["Date"] });

      vi.setSystemTime(deadline.getTime() + WINDOW);
      const atBoundary = await submit(m.id, tokens.student1);
      expect(atBoundary.status).toBe(201);
      expect(atBoundary.body.submission.version).toBe(1);
      expect(atBoundary.body.submission.daysLate).toBe(7);

      vi.setSystemTime(deadline.getTime() + WINDOW + 1);
      const afterWindow = await submit(m.id, tokens.student1, { ...validBody, title: "One millisecond too late" });
      expect(afterWindow.status).toBe(409);
      expect(afterWindow.body.error).toEqual(WINDOW_CLOSED);

      expect(await countOf(m.id)).toBe(1);
    });

    it("TEST-03-20: closed window keeps the version limit first and the 401/403/404/400 answers", async () => {
      const deadline = new Date(Date.now() - 8 * DAY);

      // (a) 3 versions already stored: the version limit is reported, not the window
      const full = await alphaMilestone(deadline, "CHG-03 closed, 3 versions");
      for (const v of [1, 2, 3]) {
        await storedVersion(full.id, v, new Date(deadline.getTime() + v * 60 * 60 * 1000), 1);
      }
      const limit = await submit(full.id, tokens.student1);
      expect(limit.status).toBe(409);
      expect(limit.body.error.code).toBe("VERSION_LIMIT_REACHED");
      expect(await countOf(full.id)).toBe(3);

      // (b) no versions: earlier checks still answer before the window
      const empty = await alphaMilestone(deadline, "CHG-03 closed, empty");

      const invalid = await submit(empty.id, tokens.student1, { title: "Bad link", link: "not-a-url" });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
      expect(invalid.body.error.details).toEqual({ link: "INVALID_URL" });

      const asSupervisor = await submit(empty.id, tokens.supervisor1);
      expect(asSupervisor.status).toBe(403);
      expect(asSupervisor.body.error.code).toBe("FORBIDDEN");

      const otherTeam = await submit(empty.id, tokens.student3);
      expect(otherTeam.status).toBe(404);
      expect(otherTeam.body.error.code).toBe("NOT_FOUND");

      const noToken = await submit(empty.id, undefined);
      expect(noToken.status).toBe(401);
      expect(noToken.body.error.code).toBe("UNAUTHENTICATED");

      expect(await countOf(empty.id)).toBe(0);
    });

    it("TEST-03-21: versions stored before the change with daysLate > 7 are still listed unchanged", async () => {
      const deadline = new Date(Date.now() - 30 * DAY);
      const m = await alphaMilestone(deadline, "CHG-03 historical data");
      const old = await storedVersion(m.id, 1, new Date(deadline.getTime() + 11.5 * DAY), 12);

      const asStudent = await request(app)
        .get(`/api/milestones/${m.id}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`);
      expect(asStudent.status).toBe(200);
      expect(asStudent.body.submissions).toHaveLength(1);
      expect(asStudent.body.submissions[0]).toMatchObject({ id: old.id, version: 1, daysLate: 12 });

      const asSupervisor = await request(app)
        .get(`/api/milestones/${m.id}/submissions`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`);
      expect(asSupervisor.status).toBe(200);
      expect(asSupervisor.body.submissions[0]).toMatchObject({ id: old.id, version: 1, daysLate: 12 });

      const single = await request(app)
        .get(`/api/submissions/${old.id}`)
        .set("Authorization", `Bearer ${tokens.student1}`);
      expect(single.status).toBe(200);
      expect(single.body.submission).toMatchObject({ id: old.id, daysLate: 12 });
    });

    it("TEST-03-22: extending the deadline (F-05, BR-13) reopens a closed window; daysLate uses the new deadline", async () => {
      const m = await alphaMilestone(new Date(Date.now() - 10 * DAY), "CHG-03 extension");

      const closed = await submit(m.id, tokens.student1);
      expect(closed.status).toBe(409);
      expect(closed.body.error).toEqual(WINDOW_CLOSED);
      expect(await countOf(m.id)).toBe(0);

      const extended = await request(app)
        .patch(`/api/milestones/${m.id}`)
        .set("Authorization", `Bearer ${tokens.supervisor1}`)
        // 23 h ago, so the next submission is less than 24 h late (an exact 24 h would round up to 2 days).
        .send({ deadline: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString() });
      expect(extended.status).toBe(200);

      const reopened = await submit(m.id, tokens.student1);
      expect(reopened.status).toBe(201);
      expect(reopened.body.submission.version).toBe(1);
      expect(reopened.body.submission.daysLate).toBe(1);
    });
  });
});
