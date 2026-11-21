import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

// F-09 Derived Team Milestone Status (contract docs/sprints/sprint-2/F-09-milestone-status.md).

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;
const PREFIX = "F09-";

const tokens: Record<string, string> = {};
const teamIds: Record<string, number> = {};
let supervisor1Id: number;

async function login(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

describe("F-09 Derived Team Milestone Status API", () => {
  beforeAll(async () => {
    await seed();
    for (const name of ["student1", "student3", "supervisor1", "supervisor2"]) {
      tokens[name] = await login(`${name}@cpms.test`);
    }
    for (const team of await getPrisma().team.findMany()) {
      teamIds[team.name] = team.id;
    }
    supervisor1Id = (await getPrisma().user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } })).id;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await getPrisma().feedback.deleteMany({ where: { submission: { milestone: { title: { startsWith: PREFIX } } } } });
    await getPrisma().submission.deleteMany({ where: { milestone: { title: { startsWith: PREFIX } } } });
    await getPrisma().milestone.deleteMany({ where: { title: { startsWith: PREFIX } } });
  });

  async function createAlphaMilestone(title: string, deadline: Date) {
    return getPrisma().milestone.create({
      data: {
        teamId: teamIds["Team Alpha"],
        title: `${PREFIX}${title}`,
        deadline,
        createdById: supervisor1Id,
      },
    });
  }

  async function readListAndDetail(milestoneId: number, token: string) {
    const [listRes, detailRes] = await Promise.all([
      request(app).get(`/api/teams/${teamIds["Team Alpha"]}/milestones`).set("Authorization", `Bearer ${token}`),
      request(app).get(`/api/milestones/${milestoneId}`).set("Authorization", `Bearer ${token}`),
    ]);
    expect(listRes.status).toBe(200);
    expect(detailRes.status).toBe(200);
    const inList = listRes.body.milestones.find((m: { id: number }) => m.id === milestoneId);
    expect(inList).toBeDefined();
    expect(inList.status).toBe(detailRes.body.milestone.status);
    return detailRes.body.milestone.status as string;
  }

  it("TEST-09-01: unsubmitted milestones report Not submitted or Overdue (including > 7d closed window) on list and detail", async () => {
    const now = Date.now();
    const future = await createAlphaMilestone("Future", new Date(now + 3 * DAY));
    const pastOpen = await createAlphaMilestone("Past open window", new Date(now - 2 * DAY));
    const pastClosed = await createAlphaMilestone("Past closed window", new Date(now - 10 * DAY));

    expect(await readListAndDetail(future.id, tokens.student1)).toBe("Not submitted");
    expect(await readListAndDetail(pastOpen.id, tokens.student1)).toBe("Overdue");
    expect(await readListAndDetail(pastClosed.id, tokens.student1)).toBe("Overdue");

    expect(await readListAndDetail(future.id, tokens.supervisor1)).toBe("Not submitted");
    expect(await readListAndDetail(pastClosed.id, tokens.supervisor1)).toBe("Overdue");
  });

  it("TEST-09-02: tracks submission, feedback, and late resubmission transitions on list and detail", async () => {
    const baseNow = Date.now();
    // 10 s ahead for on-time v1, then advance +20 s for late v2 (well inside 2 h token lifetime).
    const deadline = new Date(baseNow + 10_000);
    const m = await createAlphaMilestone("Lifecycle", deadline);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(baseNow + 2_000);

    expect(await readListAndDetail(m.id, tokens.student1)).toBe("Not submitted");

    const v1 = await request(app)
      .post(`/api/milestones/${m.id}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "v1 on time", link: "https://example.com/v1" });
    expect(v1.status).toBe(201);
    expect(v1.body.submission.daysLate).toBe(0);
    expect(await readListAndDetail(m.id, tokens.student1)).toBe("Submitted");

    const fb1 = await request(app)
      .post(`/api/submissions/${v1.body.submission.id}/feedback`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ comment: "Fix section 2" });
    expect(fb1.status).toBe(201);
    expect(await readListAndDetail(m.id, tokens.supervisor1)).toBe("Reviewed");

    vi.setSystemTime(baseNow + 20_000);
    const v2 = await request(app)
      .post(`/api/milestones/${m.id}/submissions`)
      .set("Authorization", `Bearer ${tokens.student1}`)
      .send({ title: "v2 late resubmission", link: "https://example.com/v2" });
    expect(v2.status).toBe(201);
    expect(v2.body.submission.daysLate).toBe(1);
    expect(await readListAndDetail(m.id, tokens.student1)).toBe("Submitted late");

    const fb2 = await request(app)
      .post(`/api/submissions/${v2.body.submission.id}/feedback`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ comment: "Looks good now" });
    expect(fb2.status).toBe(201);
    expect(await readListAndDetail(m.id, tokens.student1)).toBe("Reviewed");
  });

  it("TEST-09-03: extending a closed-window Overdue deadline to future returns status to Not submitted", async () => {
    const m = await createAlphaMilestone("Extend from closed", new Date(Date.now() - 10 * DAY));
    expect(await readListAndDetail(m.id, tokens.student1)).toBe("Overdue");

    const patched = await request(app)
      .patch(`/api/milestones/${m.id}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ deadline: new Date(Date.now() + 3 * DAY).toISOString() });
    expect(patched.status).toBe(200);
    expect(patched.body.milestone.status).toBe("Not submitted");

    expect(await readListAndDetail(m.id, tokens.student1)).toBe("Not submitted");
  });

  it("TEST-09-04: milestone create (F-02, F-06) and edit (F-05) responses return derived status", async () => {
    const deadline = new Date(Date.now() + 5 * DAY).toISOString();

    const single = await request(app)
      .post(`/api/teams/${teamIds["Team Alpha"]}/milestones`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: `${PREFIX}Single`, deadline });
    expect(single.status).toBe(201);
    expect(single.body.milestone.status).toBe("Not submitted");

    const multi = await request(app)
      .post("/api/milestones")
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({
        teamIds: [teamIds["Team Alpha"], teamIds["Team Beta"]],
        title: `${PREFIX}Multi`,
        deadline,
      });
    expect(multi.status).toBe(201);
    expect(multi.body.milestones.map((m: { status: string }) => m.status)).toEqual(["Not submitted", "Not submitted"]);

    const edited = await request(app)
      .patch(`/api/milestones/${single.body.milestone.id}`)
      .set("Authorization", `Bearer ${tokens.supervisor1}`)
      .send({ title: `${PREFIX}Single updated` });
    expect(edited.status).toBe(200);
    expect(edited.body.milestone.status).toBe("Not submitted");
  });

  it("TEST-09-05: milestone list and detail keep existing 404/401 access rules unchanged", async () => {
    const m = await createAlphaMilestone("Access", new Date(Date.now() + 4 * DAY));
    const alphaId = teamIds["Team Alpha"];

    for (const outsider of [tokens.student3, tokens.supervisor2]) {
      const list = await request(app).get(`/api/teams/${alphaId}/milestones`).set("Authorization", `Bearer ${outsider}`);
      expect(list.status).toBe(404);
      expect(list.body.milestones).toBeUndefined();

      const detail = await request(app).get(`/api/milestones/${m.id}`).set("Authorization", `Bearer ${outsider}`);
      expect(detail.status).toBe(404);
      expect(detail.body.milestone).toBeUndefined();
    }

    expect((await request(app).get(`/api/teams/${alphaId}/milestones`)).status).toBe(401);
    expect((await request(app).get(`/api/milestones/${m.id}`)).status).toBe(401);

    // Positive controls
    expect(await readListAndDetail(m.id, tokens.student1)).toBe("Not submitted");
    expect(await readListAndDetail(m.id, tokens.supervisor1)).toBe("Not submitted");
  });
});
