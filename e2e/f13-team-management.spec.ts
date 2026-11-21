import { APIRequestContext, test, expect } from "@playwright/test";
import { DEMO_PASSWORD, loginAs, logout, toLocalDatetimeInputValue } from "./helpers.js";

interface PersonDto {
  id: number;
  name: string;
  email: string;
}

interface TeamDto {
  id: number;
  name: string;
  members: PersonDto[];
}

// Idempotently ensure student2@cpms.test belongs to Team Alpha before/after the test so the spec
// stays repeatable on both fresh CI databases and reused local databases.
async function ensureStudentTwoInAlpha(request: APIRequestContext) {
  const loginRes = await request.post("/api/auth/login", {
    data: { email: "supervisor1@cpms.test", password: DEMO_PASSWORD },
  });
  if (!loginRes.ok()) return;
  const { token } = (await loginRes.json()) as { token: string };
  const headers = { Authorization: `Bearer ${token}` };

  const teamsRes = await request.get("/api/teams", { headers });
  if (!teamsRes.ok()) return;
  const { teams } = (await teamsRes.json()) as { teams: TeamDto[] };
  const alpha = teams.find((t) => t.name === "Team Alpha");
  if (!alpha || alpha.members.some((m) => m.email === "student2@cpms.test")) return;

  let student2Id: number | undefined;
  const currentTeam = teams.find((t) => t.members.some((m) => m.email === "student2@cpms.test"));
  if (currentTeam) {
    student2Id = currentTeam.members.find((m) => m.email === "student2@cpms.test")?.id;
    if (student2Id !== undefined) {
      await request.delete(`/api/teams/${currentTeam.id}/members/${student2Id}`, { headers });
    }
  } else {
    const availRes = await request.get("/api/teams/available-students", { headers });
    if (availRes.ok()) {
      const { students } = (await availRes.json()) as { students: PersonDto[] };
      student2Id = students.find((s) => s.email === "student2@cpms.test")?.id;
    }
  }

  if (student2Id !== undefined) {
    await request.post(`/api/teams/${alpha.id}/members`, { headers, data: { studentId: student2Id } });
  }
}

test.describe("F-13 Team Management Journey (TEST-13-15)", () => {
  test.beforeEach(async ({ request }) => {
    await ensureStudentTwoInAlpha(request);
  });

  test.afterEach(async ({ request }) => {
    await ensureStudentTwoInAlpha(request);
  });

  test("supervisor creates a team, moves a submitting member, and BR-14 preserves original submitter while revoking old team access", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const newTeamName = `F13 Team ${timestamp}`;
    const alphaMilestoneTitle = `F13 BR14 Alpha ${timestamp}`;
    const newTeamMilestoneTitle = `F13 New Team Work ${timestamp}`;
    const deadlineValue = toLocalDatetimeInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const studentTwoMemberRow = page.locator(".member-info", { hasText: "Student Two (student2@cpms.test)" });

    // 1. Supervisor creates a milestone on Team Alpha and Student Two submits on it
    await loginAs(page, "supervisor1@cpms.test");
    await page.locator(".card-grid .card").filter({ hasText: "Team Alpha" }).getByRole("link", { name: "Open team" }).click();
    await page.getByLabel("Title").fill(alphaMilestoneTitle);
    await page.getByLabel("Deadline").fill(deadlineValue);
    await page.getByRole("button", { name: "Create milestone" }).click();
    await expect(page.locator(".milestone-list li").filter({ hasText: alphaMilestoneTitle })).toBeVisible();
    await page.getByRole("link", { name: alphaMilestoneTitle }).click();
    await expect(page).toHaveURL(/\/supervisor\/milestones\/(\d+)/);
    const alphaMilestoneId = page.url().split("/").pop()!;
    await logout(page);

    await loginAs(page, "student2@cpms.test");
    await page.getByRole("link", { name: alphaMilestoneTitle }).click();
    await page.getByLabel("Submission title").fill(`Student Two Work ${timestamp}`);
    await page.getByLabel("Link").fill("https://github.com/alpha-team/project/pull/13");
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.locator(".submission-item").filter({ hasText: "Submitted by: Student Two" })).toBeVisible();
    await logout(page);

    // 2. Supervisor creates a new team on /supervisor and reloads to verify persistence
    await loginAs(page, "supervisor1@cpms.test");
    await page.getByLabel("Team name").fill(newTeamName);
    await page.getByRole("button", { name: "Create team" }).click();
    await expect(page.locator(".card-grid .card").filter({ hasText: newTeamName })).toBeVisible();
    await page.reload();
    await expect(page.locator(".card-grid .card").filter({ hasText: newTeamName })).toBeVisible();

    // 3. Remove Student Two from Team Alpha and add to the new team (remove + add move)
    await page.locator(".card-grid .card").filter({ hasText: "Team Alpha" }).getByRole("link", { name: "Open team" }).click();
    await page.getByRole("button", { name: "Remove Student Two" }).click();
    await expect(page.getByRole("button", { name: "Remove Student Two" })).not.toBeVisible();

    await page.getByRole("link", { name: "← My teams" }).click();
    await page.locator(".card-grid .card").filter({ hasText: newTeamName }).getByRole("link", { name: "Open team" }).click();
    await expect(page.getByRole("heading", { name: newTeamName })).toBeVisible();

    const picker = page.getByLabel("Student", { exact: true });
    await expect(picker.locator("option", { hasText: "Student Two" })).toBeAttached();
    const optionValue = await picker.locator("option", { hasText: "Student Two" }).getAttribute("value");
    await picker.selectOption(optionValue!);
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(studentTwoMemberRow).toBeVisible();

    await page.reload();
    await expect(studentTwoMemberRow).toBeVisible();

    // New team accepts milestones (F-02)
    await page.getByLabel("Title").fill(newTeamMilestoneTitle);
    await page.getByLabel("Deadline").fill(deadlineValue);
    await page.getByRole("button", { name: "Create milestone" }).click();
    await expect(page.locator(".milestone-list li").filter({ hasText: newTeamMilestoneTitle })).toBeVisible();

    // BR-14 check: Team Alpha's earlier submission still shows Submitted by: Student Two
    await page.goto(`/supervisor/milestones/${alphaMilestoneId}`);
    await expect(page.locator(".submission-item").filter({ hasText: "Submitted by: Student Two" })).toBeVisible();
    await logout(page);

    // 4. Moved student sees only new team and gets 404 on old Team Alpha milestone
    await loginAs(page, "student2@cpms.test");
    await expect(page.getByRole("heading", { name: newTeamName })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team Alpha" })).not.toBeVisible();
    await page.goto(`/student/milestones/${alphaMilestoneId}`);
    await expect(page.getByText("Milestone not found or not allowed")).toBeVisible();
    await logout(page);

    // 5. Restore Student Two back into Team Alpha via UI (also guarded by afterEach cleanup)
    await loginAs(page, "supervisor1@cpms.test");
    await page.locator(".card-grid .card").filter({ hasText: newTeamName }).getByRole("link", { name: "Open team" }).click();
    await page.getByRole("button", { name: "Remove Student Two" }).click();
    await expect(page.getByRole("button", { name: "Remove Student Two" })).not.toBeVisible();

    await page.getByRole("link", { name: "← My teams" }).click();
    await page.locator(".card-grid .card").filter({ hasText: "Team Alpha" }).getByRole("link", { name: "Open team" }).click();
    const alphaPicker = page.getByLabel("Student", { exact: true });
    await expect(alphaPicker.locator("option", { hasText: "Student Two" })).toBeAttached();
    const restoreVal = await alphaPicker.locator("option", { hasText: "Student Two" }).getAttribute("value");
    await alphaPicker.selectOption(restoreVal!);
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(studentTwoMemberRow).toBeVisible();
  });
});
