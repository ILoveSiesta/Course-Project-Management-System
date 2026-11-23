import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

// Defect #94 group A (DEF-DEADLINE): the API must not store a repaired or guessed deadline
// (F-02 v0.5 TEST-02-17, F-05 v0.5 TEST-05-11).

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;
const Y = new Date().getUTCFullYear() + 2;
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
let LEAP = Y;
while (!isLeap(LEAP)) LEAP += 1;
const LEAP_DAY = `${LEAP}-02-29T12:00:00.000Z`;

let supervisorToken: string;
let alphaId: number;
let betaId: number;
let supervisor1Id: number;

async function milestoneCount() {
  return getPrisma().milestone.count();
}

describe("#94 DEF-DEADLINE: exact deadline format through the API", () => {
  beforeAll(async () => {
    await seed();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "supervisor1@cpms.test", password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    supervisorToken = res.body.token;
    const prisma = getPrisma();
    alphaId = (await prisma.team.findFirstOrThrow({ where: { name: "Team Alpha" } })).id;
    betaId = (await prisma.team.findFirstOrThrow({ where: { name: "Team Beta" } })).id;
    supervisor1Id = (await prisma.user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } })).id;
  });

  it("TEST-02-17: create (F-02 and F-06) rejects impossible and non-ISO deadlines and stores nothing; 29 Feb of a leap year is accepted", async () => {
    const invalid = [`${Y}-02-30T12:00:00.000Z`, `${Y}`, `${Y}-05-05T10:00:00`];

    for (const deadline of invalid) {
      const before = await milestoneCount();

      const single = await request(app)
        .post(`/api/teams/${alphaId}/milestones`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ title: `DEF-DEADLINE ${deadline}`, deadline });
      expect(single.status, `F-02 ${deadline}`).toBe(400);
      expect(single.body.error).toMatchObject({ code: "VALIDATION_ERROR", details: { deadline: "INVALID_DATE" } });

      const multi = await request(app)
        .post("/api/milestones")
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ teamIds: [alphaId, betaId], title: `DEF-DEADLINE ${deadline}`, deadline });
      expect(multi.status, `F-06 ${deadline}`).toBe(400);
      expect(multi.body.error).toMatchObject({ code: "VALIDATION_ERROR", details: { deadline: "INVALID_DATE" } });

      expect(await milestoneCount(), `nothing stored for ${deadline}`).toBe(before);
    }

    // Positive control: a real leap day is stored as the same instant.
    const ok = await request(app)
      .post(`/api/teams/${alphaId}/milestones`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ title: "DEF-DEADLINE leap day", deadline: LEAP_DAY });
    expect(ok.status).toBe(201);
    expect(ok.body.milestone.deadline).toBe(LEAP_DAY);
    const row = await getPrisma().milestone.findUniqueOrThrow({ where: { id: ok.body.milestone.id } });
    expect(row.deadline.toISOString()).toBe(LEAP_DAY);
  });

  it("TEST-05-11: edit rejects impossible and non-ISO deadlines and changes nothing; 29 Feb of a leap year is accepted", async () => {
    const original = new Date(Date.now() + DAY);
    const m = await getPrisma().milestone.create({
      data: { teamId: alphaId, title: "DEF-DEADLINE edit", deadline: original, createdById: supervisor1Id },
    });
    const invalid = [`${Y}-02-30T12:00:00.000Z`, `${Y}-04-31T12:00:00Z`, `x ${Y}`, `05/06/${Y}`, `${Y}-05-05T10:00:00`];

    for (const deadline of invalid) {
      const res = await request(app)
        .patch(`/api/milestones/${m.id}`)
        .set("Authorization", `Bearer ${supervisorToken}`)
        .send({ title: "Changed", deadline });
      expect(res.status, deadline).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", details: { deadline: "INVALID_DATE" } });

      const row = await getPrisma().milestone.findUniqueOrThrow({ where: { id: m.id } });
      expect(row.title, `title unchanged for ${deadline}`).toBe("DEF-DEADLINE edit");
      expect(row.deadline.toISOString(), `deadline unchanged for ${deadline}`).toBe(original.toISOString());
    }

    const ok = await request(app)
      .patch(`/api/milestones/${m.id}`)
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ deadline: LEAP_DAY });
    expect(ok.status).toBe(200);
    expect(ok.body.milestone.deadline).toBe(LEAP_DAY);
  });
});
