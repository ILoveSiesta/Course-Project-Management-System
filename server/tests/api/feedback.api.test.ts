import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;

const tokens: Record<string, string> = {};
const createdMilestoneIds: number[] = [];

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

// A fresh Team Alpha milestone (supervisor1) with one version submitted by student1.
async function newVersion(): Promise<{ milestoneId: number; submissionId: number }> {
  const alpha = await getPrisma().team.findUniqueOrThrow({ where: { name: "Team Alpha" } });
  const milestone = await request(app)
    .post(`/api/teams/${alpha.id}/milestones`)
    .set("Authorization", `Bearer ${tokens.supervisor1}`)
    .send({ title: "Feedback test milestone", deadline: new Date(Date.now() + 7 * DAY).toISOString() });
  expect(milestone.status).toBe(201);
  createdMilestoneIds.push(milestone.body.milestone.id);

  const submission = await request(app)
    .post(`/api/milestones/${milestone.body.milestone.id}/submissions`)
    .set("Authorization", `Bearer ${tokens.student1}`)
    .send({ title: "Version for feedback", link: "https://github.com/alpha/repo/pull/1" });
  expect(submission.status).toBe(201);

  return { milestoneId: milestone.body.milestone.id, submissionId: submission.body.submission.id };
}

function postFeedback(token: string | undefined, submissionId: number | string, body: unknown) {
  const req = request(app).post(`/api/submissions/${submissionId}/feedback`);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send(body as object);
}

function feedbackCount(submissionId: number): Promise<number> {
  return getPrisma().feedback.count({ where: { submissionId } });
}

describe("F-04 Feedback API", () => {
  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "supervisor1", "supervisor2"]) {
      tokens[name] = await login(`${name}@cpms.test`);
    }
  });

  afterAll(async () => {
    const where = { milestoneId: { in: createdMilestoneIds } };
    await getPrisma().feedback.deleteMany({ where: { submission: where } });
    await getPrisma().submission.deleteMany({ where });
    await getPrisma().milestone.deleteMany({ where: { id: { in: createdMilestoneIds } } });
  });

  it("TEST-04-01: an assigned supervisor records feedback on a version and it is stored", async () => {
    const { submissionId } = await newVersion();
    const supervisor1 = await getPrisma().user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } });

    const res = await postFeedback(tokens.supervisor1, submissionId, { comment: "  Good structure, add NFR targets.  " });

    expect(res.status).toBe(201);
    expect(res.body.feedback).toMatchObject({
      submissionId,
      comment: "Good structure, add NFR targets.",
      author: { id: supervisor1.id, name: "Supervisor One" },
    });

    const stored = await getPrisma().feedback.findUniqueOrThrow({ where: { id: res.body.feedback.id } });
    expect(stored.submissionId).toBe(submissionId);
    expect(stored.authorId).toBe(supervisor1.id);
    expect(stored.comment).toBe("Good structure, add NFR targets.");
  });

  it("TEST-04-02: several feedback entries on one version are returned oldest first", async () => {
    const { milestoneId, submissionId } = await newVersion();

    expect((await postFeedback(tokens.supervisor1, submissionId, { comment: "First note" })).status).toBe(201);
    expect((await postFeedback(tokens.supervisor1, submissionId, { comment: "Second note" })).status).toBe(201);

    const list = await request(app)
      .get(`/api/milestones/${milestoneId}/submissions`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`);
    expect(list.status).toBe(200);
    expect(list.body.submissions[0].feedback.map((f: { comment: string }) => f.comment)).toEqual([
      "First note",
      "Second note",
    ]);
  });

  it("TEST-04-03: a student gets 403 and nothing is stored", async () => {
    const { submissionId } = await newVersion();
    expect((await postFeedback(tokens.supervisor1, submissionId, { comment: "Control" })).status).toBe(201);
    const before = await feedbackCount(submissionId);

    const res = await postFeedback(tokens.student1, submissionId, { comment: "Self-review" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "FORBIDDEN", message: "Forbidden" } });
    expect(await feedbackCount(submissionId)).toBe(before);
  });

  it("TEST-04-04: an unassigned supervisor, unknown and non-numeric IDs get 404 and nothing is stored", async () => {
    const { submissionId } = await newVersion();
    expect((await postFeedback(tokens.supervisor1, submissionId, { comment: "Control" })).status).toBe(201);
    const before = await feedbackCount(submissionId);

    const outsider = await postFeedback(tokens.supervisor2, submissionId, { comment: "Not my team" });
    expect(outsider.status).toBe(404);
    expect(outsider.body).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } });

    for (const id of [999999, "abc"]) {
      const res = await postFeedback(tokens.supervisor1, id, { comment: "Nowhere" });
      expect(res.status, `id ${id}`).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    expect(await feedbackCount(submissionId)).toBe(before);
  });

  it("TEST-04-05: invalid comments are rejected with details; 5000 characters is accepted", async () => {
    const { submissionId } = await newVersion();
    const cases: Array<[unknown, string]> = [
      [{}, "REQUIRED"],
      [{ comment: "   " }, "REQUIRED"],
      [{ comment: "x".repeat(5001) }, "TOO_LONG"],
      [{ comment: 42 }, "INVALID_TYPE"],
    ];

    for (const [body, code] of cases) {
      const res = await postFeedback(tokens.supervisor1, submissionId, body);
      expect(res.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual({ comment: code });
    }
    expect(await feedbackCount(submissionId)).toBe(0);

    const max = await postFeedback(tokens.supervisor1, submissionId, { comment: "y".repeat(5000) });
    expect(max.status).toBe(201);
    expect(await feedbackCount(submissionId)).toBe(1);
  });

  it("TEST-04-06: feedback stays on version 1 after version 2 is submitted", async () => {
    const { milestoneId, submissionId } = await newVersion();
    expect((await postFeedback(tokens.supervisor1, submissionId, { comment: "Fix the ER diagram" })).status).toBe(201);

    const v2 = await request(app)
      .post(`/api/milestones/${milestoneId}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "Version 2", link: "https://github.com/alpha/repo/pull/2" });
    expect(v2.status).toBe(201);

    const list = await request(app)
      .get(`/api/milestones/${milestoneId}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`);
    const [first, second] = list.body.submissions;
    expect(first.version).toBe(1);
    expect(first.feedback.map((f: { comment: string }) => f.comment)).toEqual(["Fix the ER diagram"]);
    expect(second.version).toBe(2);
    expect(second.feedback).toEqual([]);
  });

  it("TEST-04-07: in-scope students and supervisors see feedback with author and time", async () => {
    const { milestoneId, submissionId } = await newVersion();
    const created = await postFeedback(tokens.supervisor1, submissionId, { comment: "Looks complete" });
    expect(created.status).toBe(201);

    for (const who of ["student1", "supervisor1"]) {
      const list = await request(app)
        .get(`/api/milestones/${milestoneId}/submissions`)
        .set("Authorization", `Bearer ${tokens[who]}`);
      const single = await request(app)
        .get(`/api/submissions/${submissionId}`)
        .set("Authorization", `Bearer ${tokens[who]}`);

      for (const feedback of [list.body.submissions[0].feedback, single.body.submission.feedback]) {
        expect(feedback, who).toHaveLength(1);
        expect(feedback[0]).toMatchObject({
          id: created.body.feedback.id,
          comment: "Looks complete",
          author: { name: "Supervisor One" },
        });
        expect(new Date(feedback[0].createdAt).toISOString()).toBe(feedback[0].createdAt);
      }
    }
  });

  it("TEST-04-08: posting feedback without a token gets 401", async () => {
    const { submissionId } = await newVersion();
    expect((await postFeedback(tokens.supervisor1, submissionId, { comment: "Control" })).status).toBe(201);

    const res = await postFeedback(undefined, submissionId, { comment: "Anonymous" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("TEST-04-09: feedback cannot be edited or deleted", async () => {
    const { submissionId } = await newVersion();
    const created = await postFeedback(tokens.supervisor1, submissionId, { comment: "Original" });
    expect(created.status).toBe(201);
    const path = `/api/submissions/${submissionId}/feedback/${created.body.feedback.id}`;

    const patch = await request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ comment: "Changed" });
    const del = await request(app).delete(path).set("Authorization", `Bearer ${tokens.supervisor1}`);

    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
    const stored = await getPrisma().feedback.findUniqueOrThrow({ where: { id: created.body.feedback.id } });
    expect(stored.comment).toBe("Original");
  });
});
