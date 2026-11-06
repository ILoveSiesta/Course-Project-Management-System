import { test, expect } from "@playwright/test";
import { loginAs, logout } from "./helpers.js";

test.describe("Sprint 1 Rejection and Access Journey (TEST-E2E-02)", () => {
  test("business-rule rejections: milestone validation, submission validation, 3-version limit, and access control", async ({
    page,
  }) => {
    const timestamp = Date.now();

    // ==========================================
    // 1. Milestone validation rejection (BR-04, NFR-12)
    // ==========================================
    await loginAs(page, "supervisor1@cpms.test");
    await page.locator(".card").filter({ hasText: "Team Alpha" }).getByRole("link", { name: "Open team" }).click();

    // Submit with blank title and past deadline
    await page.getByLabel("Title").fill("");
    await page.getByLabel("Deadline").fill("2020-01-01T12:00");
    await page.getByRole("button", { name: "Create milestone" }).click();

    await expect(page.getByText("Required")).toBeVisible();
    await expect(page.getByText("Deadline must be in the future")).toBeVisible();

    // Now create a valid milestone to use for subsequent tests
    const validTitle = `E2E Rejection Testing - ${timestamp}`;
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await page.getByLabel("Title").fill(validTitle);
    await page.getByLabel("Deadline").fill(futureDate.toISOString().slice(0, 16));
    await page.getByRole("button", { name: "Create milestone" }).click();

    // Wait until created and get its milestone URL
    await expect(page.locator(".milestone-list li").filter({ hasText: validTitle })).toBeVisible();
    await page.getByRole("link", { name: validTitle }).click();
    await expect(page).toHaveURL(/\/supervisor\/milestones\/(\d+)/);
    const alphaMilestoneUrl = page.url();
    const milestoneId = alphaMilestoneUrl.split("/").pop()!;

    await logout(page);

    // ==========================================
    // 2. Submission validation rejection (BR-08, NFR-12)
    // ==========================================
    await loginAs(page, "student1@cpms.test");
    await page.goto(`/student/milestones/${milestoneId}`);
    await expect(page.getByRole("heading", { name: validTitle })).toBeVisible();

    // Try submitting with invalid link protocol (ftp://) and empty title
    await page.getByLabel("Submission title").fill("");
    await page.getByLabel("Link").fill("ftp://example.com/invalid");
    await page.getByRole("button", { name: "Submit work" }).click();

    await expect(page.getByText("Required")).toBeVisible();
    await expect(page.getByText("Link must be an http or https URL")).toBeVisible();

    // ==========================================
    // 3. 3-Version Limit rejection (BR-07, NFR-12, D-02)
    // ==========================================
    // Submit Version 1
    await page.getByLabel("Submission title").fill("Design v1");
    await page.getByLabel("Link").fill("https://example.com/v1");
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByText("Version 1: Design v1")).toBeVisible();

    // Submit Version 2
    await page.getByLabel("Submission title").fill("Design v2");
    await page.getByLabel("Link").fill("https://example.com/v2");
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByText("Version 2: Design v2")).toBeVisible();

    // Submit Version 3
    await page.getByLabel("Submission title").fill("Design v3");
    await page.getByLabel("Link").fill("https://example.com/v3");
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByText("Version 3: Design v3")).toBeVisible();

    // When 3 versions exist, form is hidden and replaces with friendly message
    await expect(page.getByText("Maximum of 3 versions reached for this milestone.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit work" })).not.toBeVisible();

    await logout(page);

    // ==========================================
    // 4. Access control & scope restrictions (BR-01, BR-02, NFR-03)
    // ==========================================
    // 4a. Cross-team student (student3 from Team Beta attempts to view Team Alpha milestone)
    await loginAs(page, "student3@cpms.test");
    await page.goto(`/student/milestones/${milestoneId}`);
    await expect(page.getByText("Milestone not found or not allowed")).toBeVisible();
    // Verify Team Alpha data is not leaked
    await expect(page.getByText(validTitle)).not.toBeVisible();
    await logout(page);

    // 4b. Unassigned supervisor (supervisor2 not assigned to Team Alpha attempts to view Team Alpha milestone)
    await loginAs(page, "supervisor2@cpms.test");
    await page.goto(`/supervisor/milestones/${milestoneId}`);
    await expect(page.getByText("Milestone not found or not allowed")).toBeVisible();
    await expect(page.getByText(validTitle)).not.toBeVisible();

    // 4c. Unassigned supervisor attempts to view Team Alpha team page
    await page.goto("/supervisor/teams/1");
    await expect(page.getByText("Team not found or not allowed")).toBeVisible();
    await logout(page);
  });
});
