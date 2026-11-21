import { test, expect } from "@playwright/test";
import { loginAs, logout, toLocalDatetimeInputValue } from "./helpers.js";

test.describe("F-13 Team Management Journey (TEST-13-15)", () => {
  test("supervisor creates a team, moves a submitting member, and BR-14 preserves original submitter while revoking old team access", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const newTeamName = `F13 Team ${timestamp}`;
    const alphaMilestoneTitle = `F13 BR14 Alpha ${timestamp}`;
    const newTeamMilestoneTitle = `F13 New Team Work ${timestamp}`;
    const deadlineValue = toLocalDatetimeInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    // 1. Supervisor creates a milestone on Team Alpha and Student Two submits on it
    await loginAs(page, "supervisor1@cpms.test");
    await page.locator(".card").filter({ hasText: "Team Alpha" }).getByRole("link", { name: "Open team" }).click();
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
    await expect(page.getByText(/Student Two \(student2@cpms\.test\)/)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/Student Two \(student2@cpms\.test\)/)).toBeVisible();

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

    // 5. Restore Student Two back into Team Alpha so shared E2E DB keeps seeded Alpha members
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
    await expect(page.getByText(/Student Two \(student2@cpms\.test\)/)).toBeVisible();
  });
});
