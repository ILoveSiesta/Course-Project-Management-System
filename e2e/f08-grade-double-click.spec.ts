import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "./helpers.js";

// Defect #103 (DEF-GRADE-BUTTON-SHIFT): F-08 contract v0.16 §3 button layout rule, AC-08-14, TEST-08-23.
// A human-speed double-click on Save grade must never release the grade (G4: a release cannot be undone).

const H = (token: string) => ({ Authorization: `Bearer ${token}` });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let sup = "";
let stu = "";
let teamId = 0;
let n = 0;

async function login(request: APIRequestContext, who: string): Promise<string> {
  const res = await request.post("/api/auth/login", { data: { email: `${who}@cpms.test`, password: DEMO_PASSWORD } });
  expect(res.status()).toBe(200);
  return (await res.json()).token;
}

test.beforeAll(async ({ request }) => {
  sup = await login(request, "supervisor1");
  stu = await login(request, "student1");
  teamId = (await (await request.get("/api/teams", { headers: H(stu) })).json()).teams[0].id;
});

// A new Alpha milestone with one submission; graded 80 on v1 unless `grade` is false.
async function newMilestone(request: APIRequestContext, grade = true): Promise<number> {
  const deadline = new Date(Date.now() + 7 * 864e5).toISOString();
  const res = await request.post(`/api/teams/${teamId}/milestones`, {
    headers: H(sup),
    data: { title: `E2E #103 ${++n} ${Date.now()}`, deadline },
  });
  expect(res.status()).toBe(201);
  const id: number = (await res.json()).milestone.id;
  const sub = await request.post(`/api/milestones/${id}/submissions`, {
    headers: H(stu),
    data: { title: "v1", link: "https://example.com/doc" },
  });
  expect(sub.status()).toBe(201);
  if (grade) {
    const put = await request.put(`/api/milestones/${id}/grade`, { headers: H(sup), data: { score: 80, version: 1 } });
    expect(put.status()).toBe(200);
  }
  return id;
}

async function storedGrade(request: APIRequestContext, id: number) {
  const body = await (await request.get(`/api/milestones/${id}/grade`, { headers: H(sup) })).json();
  return { score: body.grade?.score ?? null, released: body.released as boolean };
}

async function openMilestone(page: Page, id: number, width: number, font: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript((t) => sessionStorage.setItem("cpms_token", t), sup);
  await page.goto(`/supervisor/milestones/${id}`);
  const card = page.getByRole("region", { name: "Grade" });
  await expect(card.getByRole("button", { name: "Save grade" })).toBeVisible();
  if (font !== 16) await page.addStyleTag({ content: `html, body { font-size: ${font}px }` });
  return card;
}

// Human-speed double-click on Save grade: one press, then 280 ms later a double press at the same point.
async function doubleClickSave(page: Page, card: ReturnType<Page["getByRole"]>, at: number) {
  const save = card.getByRole("button", { name: "Save grade" });
  await save.scrollIntoViewIfNeeded();
  const b = (await save.boundingBox())!;
  const x = b.x + b.width / 2;
  const y = b.y + b.height * at;
  await page.mouse.click(x, y);
  await sleep(280);
  await page.mouse.click(x, y, { clickCount: 2 });
  await sleep(800);
}

// Save grade and Release grade share one row and do not overlap.
async function expectOneRow(card: ReturnType<Page["getByRole"]>) {
  const s = (await card.getByRole("button", { name: "Save grade" }).boundingBox())!;
  const r = (await card.getByRole("button", { name: "Release grade" }).boundingBox())!;
  expect(Math.abs(s.y - r.y)).toBeLessThan(1);
  expect(r.x).toBeGreaterThanOrEqual(s.x + s.width);
}

const viewports = [
  { width: 320, font: 16 },
  { width: 320, font: 20 },
  { width: 375, font: 20 },
];

test.describe("Defect #103 Grade card double-click (F-08 v0.16, AC-08-14)", () => {
  for (const vp of viewports) {
    test(`TEST-08-23 (a) alert cleared on retry: ${vp.width} px, ${vp.font} px font`, async ({ page, request }) => {
      for (const at of [0.5, 0.85]) {
        const id = await newMilestone(request);
        const card = await openMilestone(page, id, vp.width, vp.font);
        let first = true;
        await page.route(`**/api/milestones/${id}/grade`, (route) => {
          if (route.request().method() === "PUT" && first) {
            first = false;
            return route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } } });
          }
          return route.continue();
        });
        await card.getByLabel("Score").fill("95");
        await card.getByRole("button", { name: "Save grade" }).click();
        await expect(card.getByRole("alert")).toBeVisible();
        await doubleClickSave(page, card, at);
        expect(await storedGrade(request, id), `click at ${at}`).toEqual({ score: 95, released: false });
        await expectOneRow(card);
        await page.unrouteAll({ behavior: "ignoreErrors" });
      }
    });

    test(`TEST-08-23 (b) field error cleared on retry: ${vp.width} px, ${vp.font} px font`, async ({ page, request }) => {
      for (const at of [0.5, 0.85]) {
        const id = await newMilestone(request);
        const card = await openMilestone(page, id, vp.width, vp.font);
        await card.getByLabel("Score").fill("101");
        await card.getByRole("button", { name: "Save grade" }).click();
        await expect(card.getByText("Enter a whole number from 0 to 100")).toBeVisible();
        await card.getByLabel("Score").fill("95");
        await doubleClickSave(page, card, at);
        expect(await storedGrade(request, id), `click at ${at}`).toEqual({ score: 95, released: false });
        await expectOneRow(card);
      }
    });

    test(`TEST-08-23 (c) first grade saved: ${vp.width} px, ${vp.font} px font`, async ({ page, request }) => {
      for (const at of [0.5, 0.85]) {
        const id = await newMilestone(request, false);
        const card = await openMilestone(page, id, vp.width, vp.font);
        await expect(card.getByText("Not graded yet")).toBeVisible();
        await card.getByLabel("Score").fill("95");
        await doubleClickSave(page, card, at);
        expect(await storedGrade(request, id), `click at ${at}`).toEqual({ score: 95, released: false });
        await expectOneRow(card);
      }
    });
  }

  test("TEST-08-23 control: one click on Save grade saves and one click on Release grade releases (320 px, 20 px font)", async ({
    page,
    request,
  }) => {
    const id = await newMilestone(request);
    const card = await openMilestone(page, id, 320, 20);
    await card.getByLabel("Score").fill("95");
    await card.getByRole("button", { name: "Save grade" }).click();
    await expect(card.getByText("95 / 100 (graded on Version 1)")).toBeVisible();
    expect(await storedGrade(request, id)).toEqual({ score: 95, released: false });
    await card.getByRole("button", { name: "Release grade" }).click();
    await expect(card.getByText(/^Released:/)).toBeVisible();
    expect(await storedGrade(request, id)).toEqual({ score: 95, released: true });
  });
});
