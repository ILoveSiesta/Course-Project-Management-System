import { test, expect } from "@playwright/test";
import { loginAs, logout } from "./helpers.js";

test.describe("Sprint 1 Normal Domain Journey (TEST-E2E-01)", () => {
  test("complete domain journey: supervisor creates milestone -> student submits -> supervisor gives feedback -> student views feedback", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const milestoneTitle = `Sprint 1 Architecture - ${timestamp}`;
    const milestoneDesc = "Please submit your system architecture document and link to repository.";
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // Format YYYY-MM-DDTHH:mm for datetime-local
    const deadlineValue = futureDate.toISOString().slice(0, 16);

    // ==========================================
    // Step 1: Supervisor creates milestone
    // ==========================================
    await loginAs(page, "supervisor1@cpms.test");
    await expect(page.getByRole("heading", { name: "Supervisor Dashboard" })).toBeVisible();

    // Click Team Alpha
    await page.getByRole("link", { name: "Team Alpha" }).click();
    await expect(page).toHaveURL(/\/supervisor\/teams\/\d+/);
    await expect(page.getByRole("heading", { name: "Team Alpha" })).toBeVisible();

    // Fill Create Milestone form
    await page.getByLabel("Title").fill(milestoneTitle);
    await page.getByLabel("Description").fill(milestoneDesc);
    await page.getByLabel("Deadline").fill(deadlineValue);
    await page.getByRole("button", { name: "Create milestone" }).click();

    // Verify milestone appears in list
    const milestoneItem = page.locator(".milestone-list li").filter({ hasText: milestoneTitle });
    await expect(milestoneItem).toBeVisible();
    await expect(milestoneItem).toContainText("(ICT)");

    // Supervisor logs out
    await logout(page);

    // ==========================================
    // Step 2: Student submits work
    // ==========================================
    await loginAs(page, "student1@cpms.test");
    await expect(page.getByRole("heading", { name: "Student Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team Alpha" })).toBeVisible();

    // Find and click the newly created milestone
    await page.getByRole("link", { name: milestoneTitle }).click();
    await expect(page).toHaveURL(/\/student\/milestones\/\d+/);

    // Verify milestone details
    await expect(page.getByRole("heading", { name: milestoneTitle })).toBeVisible();
    await expect(page.getByText(milestoneDesc)).toBeVisible();
    await expect(page.getByText("No submissions yet.")).toBeVisible();

    // Submit work
    const subTitle = `Architecture Spec v1 - ${timestamp}`;
    const subDesc = "Detailed software architecture and component diagram";
    const subLink = "https://github.com/alpha-team/project/pull/1";

    await page.getByLabel("Submission title").fill(subTitle);
    await page.getByLabel("Description").fill(subDesc);
    await page.getByLabel("Link").fill(subLink);
    await page.getByRole("button", { name: "Submit work" }).click();

    // Verify submission is listed
    const subCard = page.locator(".submission-item").filter({ hasText: `Version 1: ${subTitle}` });
    await expect(subCard).toBeVisible();
    await expect(subCard.getByText("On time")).toBeVisible();
    await expect(subCard.getByText("Submitted by: Student One")).toBeVisible();
    await expect(subCard.getByRole("link", { name: subLink })).toBeVisible();
    await expect(subCard.getByText("No feedback yet.")).toBeVisible();

    // Student logs out
    await logout(page);

    // ==========================================
    // Step 3: Supervisor reviews and adds feedback
    // ==========================================
    await loginAs(page, "supervisor1@cpms.test");
    await page.getByRole("link", { name: "Team Alpha" }).click();
    await page.getByRole("link", { name: milestoneTitle }).click();
    await expect(page).toHaveURL(/\/supervisor\/milestones\/\d+/);

    const supSubCard = page.locator(".submission-item").filter({ hasText: `Version 1: ${subTitle}` });
    await expect(supSubCard).toBeVisible();
    await expect(supSubCard.getByText("Submitted by: Student One")).toBeVisible();

    // Add feedback
    const feedbackComment = `Excellent architecture diagrams for ${timestamp}. Please ensure NFR targets are measurable.`;
    await supSubCard.getByLabel("Feedback for version 1").fill(feedbackComment);
    await supSubCard.getByRole("button", { name: "Add feedback" }).click();

    // Verify feedback appears immediately
    await expect(supSubCard.getByText(feedbackComment)).toBeVisible();
    await expect(supSubCard.getByText(/by Supervisor One on .* \(ICT\)/)).toBeVisible();
    await expect(supSubCard.getByText("No feedback yet.")).not.toBeVisible();

    // Supervisor logs out
    await logout(page);

    // ==========================================
    // Step 4: Student views feedback
    // ==========================================
    await loginAs(page, "student1@cpms.test");
    await page.getByRole("link", { name: milestoneTitle }).click();
    await expect(page).toHaveURL(/\/student\/milestones\/\d+/);

    const studentSubCard = page.locator(".submission-item").filter({ hasText: `Version 1: ${subTitle}` });
    await expect(studentSubCard).toBeVisible();
    await expect(studentSubCard.getByText(feedbackComment)).toBeVisible();
    await expect(studentSubCard.getByText(/by Supervisor One on .* \(ICT\)/)).toBeVisible();

    // Verify that student view has NO "Add feedback" button (read-only for students)
    await expect(studentSubCard.getByRole("button", { name: "Add feedback" })).not.toBeVisible();

    // Clean logout
    await logout(page);
  });
});
