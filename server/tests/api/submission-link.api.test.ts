import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seed.js";

// Defect #94 group C1 (DEF-F03-CONTRACT): a link without "//" or a host is rejected and nothing is stored
// (F-03 v0.5 TEST-03-27).

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo-password";
const DAY = 24 * 60 * 60 * 1000;

let studentToken: string;
let milestoneId: number;

describe("#94 DEF-F03-CONTRACT: absolute submission links through the API", () => {
  beforeAll(async () => {
    await seed();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "student1@cpms.test", password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    studentToken = res.body.token;
    const prisma = getPrisma();
    const alpha = await prisma.team.findFirstOrThrow({ where: { name: "Team Alpha" } });
    const supervisor = await prisma.user.findUniqueOrThrow({ where: { email: "supervisor1@cpms.test" } });
    milestoneId = (
      await prisma.milestone.create({
        data: { teamId: alpha.id, title: "DEF-F03 link", deadline: new Date(Date.now() + 3 * DAY), createdById: supervisor.id },
      })
    ).id;
  });

  const submit = (link: string) =>
    request(app)
      .post(`/api/milestones/${milestoneId}/submissions`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ title: "Work", link });

  it("TEST-03-27: rejects https:example.com/doc and https:/example.com/doc, then accepts an absolute link", async () => {
    for (const link of ["https:example.com/doc", "https:/example.com/doc"]) {
      const res = await submit(link);
      expect(res.status, link).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", details: { link: "INVALID_URL" } });
      expect(await getPrisma().submission.count({ where: { milestoneId } }), `nothing stored for ${link}`).toBe(0);
    }

    const ok = await submit("https://example.com/doc");
    expect(ok.status).toBe(201);
    expect(ok.body.submission).toMatchObject({ version: 1, link: "https://example.com/doc" });
  });
});
