import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

// F-05 Milestone editing and deadline extension (contract docs/sprints/sprint-2/F-05-milestone-edit.md).

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;

const tokens: Record<string, string> = {};
let alphaId: number;
let supervisor1Id: number;

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

// Milestones are created directly in the database so that past deadlines can be set up.
async function newMilestone(deadline: Date, title = "Original title") {
  return getPrisma().milestone.create({
    data: { teamId: alphaId, title, description: "Original description", deadline, createdById: supervisor1Id },
  });
}

function patch(id: number | string, token: string | undefined, body: unknown) {
  const req = request(app).patch(`/api/milestones/${id}`);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.send(body as object);
}

async function stored(id: number) {
  return getPrisma().milestone.findUniqueOrThrow({ where: { id } });
}

describe("F-05 Milestone editing and deadline extension API", () => {
  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "supervisor1", "supervisor2"]) {
      tokens[name] = await login(`${name}@cpms.test`);
    }
    alphaId = (await getPrisma().team.findFirstOrThrow({ where: { name: "Team Alpha" } })).id;
    supervisor1Id = (await getPrisma().user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } })).id;
  });

  it("TEST-05-01: the assigned supervisor edits title and description; the deadline is unchanged", async () => {
    const deadline = new Date(Date.now() + 3 * DAY);
    const m = await newMilestone(deadline);

    const res = await patch(m.id, tokens.supervisor1, { title: "  Design review  ", description: "Bring the SDS" });

    expect(res.status).toBe(200);
    expect(res.body.milestone).toMatchObject({ id: m.id, title: "Design review", description: "Bring the SDS" });
    expect(res.body.milestone.deadline).toBe(deadline.toISOString());

    const row = await stored(m.id);
    expect(row.title).toBe("Design review");
    expect(row.description).toBe("Bring the SDS");
    expect(row.deadline.toISOString()).toBe(deadline.toISOString());

    const read = await request(app).get(`/api/milestones/${m.id}`).set("Authorization", `Bearer ${tokens.student1}`);
    expect(read.body.milestone.title).toBe("Design review");
  });

  it("TEST-05-02: a later or equal deadline is stored, and a passed deadline can be extended", async () => {
    const deadline = new Date(Date.now() + 2 * DAY);
    const m = await newMilestone(deadline);
    const later = new Date(deadline.getTime() + DAY);

    const extended = await patch(m.id, tokens.supervisor1, { deadline: later.toISOString() });
    expect(extended.status).toBe(200);
    expect(extended.body.milestone.deadline).toBe(later.toISOString());
    expect((await stored(m.id)).deadline.toISOString()).toBe(later.toISOString());

    const same = await patch(m.id, tokens.supervisor1, { deadline: later.toISOString() });
    expect(same.status).toBe(200);
    expect((await stored(m.id)).deadline.toISOString()).toBe(later.toISOString());

    const passed = await newMilestone(new Date(Date.now() - 3 * DAY));
    const stillPast = new Date(Date.now() - DAY);
    const reopened = await patch(passed.id, tokens.supervisor1, { deadline: stillPast.toISOString() });
    expect(reopened.status).toBe(200);
    expect((await stored(passed.id)).deadline.toISOString()).toBe(stillPast.toISOString());
  });

  it("TEST-05-03: an earlier deadline (1 ms) is rejected with 409 and nothing in the request is stored", async () => {
    const deadline = new Date(Date.now() + 2 * DAY);
    const m = await newMilestone(deadline);

    const res = await patch(m.id, tokens.supervisor1, {
      title: "Changed",
      deadline: new Date(deadline.getTime() - 1).toISOString(),
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: "DEADLINE_NOT_EXTENDED", message: "The deadline can only be extended, not moved earlier" },
    });
    const row = await stored(m.id);
    expect(row.title).toBe("Original title");
    expect(row.deadline.toISOString()).toBe(deadline.toISOString());

    // One millisecond later is an extension and is accepted.
    const ok = await patch(m.id, tokens.supervisor1, { deadline: new Date(deadline.getTime() + 1).toISOString() });
    expect(ok.status).toBe(200);
  });

  it("TEST-05-04: student 403, unassigned supervisor and unknown IDs 404, no token 401; nothing changes", async () => {
    const m = await newMilestone(new Date(Date.now() + 2 * DAY));
    const body = { title: "Hijacked" };

    const asStudent = await patch(m.id, tokens.student1, body);
    expect(asStudent.status).toBe(403);
    expect(asStudent.body.error.code).toBe("FORBIDDEN");

    const asOutsider = await patch(m.id, tokens.supervisor2, body);
    expect(asOutsider.status).toBe(404);
    expect(asOutsider.body).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } });

    expect((await patch(999999, tokens.supervisor1, body)).status).toBe(404);
    expect((await patch("abc", tokens.supervisor1, body)).status).toBe(404);

    const anonymous = await patch(m.id, undefined, body);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("UNAUTHENTICATED");

    expect((await stored(m.id)).title).toBe("Original title");

    // Positive control: the assigned supervisor can edit the same milestone.
    const asOwner = await patch(m.id, tokens.supervisor1, { title: "Allowed" });
    expect(asOwner.status).toBe(200);
    expect((await stored(m.id)).title).toBe("Allowed");
  });

  it("TEST-05-05: invalid input gives 400 with per-field details and nothing changes", async () => {
    const m = await newMilestone(new Date(Date.now() + 2 * DAY));
    const cases: Array<[unknown, Record<string, string>]> = [
      [{ title: "   " }, { title: "REQUIRED" }],
      [{ title: "a".repeat(121) }, { title: "TOO_LONG" }],
      [{ description: "d".repeat(2001) }, { description: "TOO_LONG" }],
      [{ deadline: "not-a-date" }, { deadline: "INVALID_DATE" }],
      [{ title: 5, deadline: 12 }, { title: "INVALID_TYPE", deadline: "INVALID_TYPE" }],
      [{}, { body: "NO_CHANGES" }],
    ];

    for (const [body, details] of cases) {
      const res = await patch(m.id, tokens.supervisor1, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details).toEqual(details);
    }
    expect((await stored(m.id)).title).toBe("Original title");

    const longest = await patch(m.id, tokens.supervisor1, { title: "a".repeat(120) });
    expect(longest.status).toBe(200);
  });

  it("TEST-05-06: after an extension, earlier versions keep their days late and new ones use the new deadline", async () => {
    // 2 days minus 1 hour ago, so the first version is 2 days late (BR-05 rounds up partial days).
    const m = await newMilestone(new Date(Date.now() - 2 * DAY + 60 * 60 * 1000));
    const submit = (title: string) =>
      request(app)
        .post(`/api/milestones/${m.id}/submissions`)
        .set("Authorization", `Bearer ${tokens.student1}`)
        .send({ title, link: "https://example.com/work" });

    const v1 = await submit("Late work");
    expect(v1.status).toBe(201);
    expect(v1.body.submission.daysLate).toBe(2);

    const extended = await patch(m.id, tokens.supervisor1, { deadline: new Date(Date.now() + 3 * DAY).toISOString() });
    expect(extended.status).toBe(200);

    const v2 = await submit("On time after extension");
    expect(v2.status).toBe(201);
    expect(v2.body.submission.daysLate).toBe(0);

    const rows = await getPrisma().submission.findMany({ where: { milestoneId: m.id }, orderBy: { version: "asc" } });
    expect(rows.map((r) => [r.version, r.daysLate])).toEqual([
      [1, 2],
      [2, 0],
    ]);
  });

  it("TEST-05-07: concurrent extensions never leave the deadline earlier than an accepted one", async () => {
    const m = await newMilestone(new Date(Date.now() + DAY));
    const plus5 = new Date(Date.now() + 5 * DAY).toISOString();
    const plus3 = new Date(Date.now() + 3 * DAY).toISOString();

    const results = await Promise.all([
      patch(m.id, tokens.supervisor1, { deadline: plus5 }),
      patch(m.id, tokens.supervisor1, { deadline: plus3 }),
    ]);

    const statuses = results.map((r) => r.status);
    expect(statuses).toContain(200);
    for (const status of statuses) expect([200, 409]).toContain(status);
    expect((await stored(m.id)).deadline.toISOString()).toBe(plus5);
  });
});
