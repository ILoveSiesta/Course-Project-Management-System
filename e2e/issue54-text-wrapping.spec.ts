import { test, expect, type Page } from "@playwright/test";
import { loginAs, logout, toLocalDatetimeInputValue } from "./helpers.js";

async function assertNoCardOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const offendingCards = Array.from(document.querySelectorAll<HTMLElement>(".card"))
      .map((el, index) => ({
        index,
        className: el.className,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }))
      .filter((c) => c.scrollWidth > c.clientWidth + 1);

    return {
      docScrollWidth: doc.scrollWidth,
      docClientWidth: doc.clientWidth,
      offendingCards,
    };
  });

  expect(metrics.docScrollWidth).toBeLessThanOrEqual(metrics.docClientWidth + 1);
  expect(metrics.offendingCards).toEqual([]);
}

test.describe("Issue #54 Long Unbroken Text Wrapping", () => {
  test("Issue #54: long unbroken milestone, submission, and feedback strings wrap within cards without horizontal overflow", async ({
    page,
  }) => {
    const suffix = String(Date.now());
    const longTitle = `${("UAT04-" + "W".repeat(120)).slice(0, 120 - suffix.length - 1)}-${suffix}`;
    const longDesc = "D".repeat(200);
    const longSubTitle = `${("SUB-" + "W".repeat(120)).slice(0, 120 - suffix.length - 1)}-${suffix}`;
    const longSubLink = `https://example.com/${"x".repeat(150)}`;
    const longFeedback = "F".repeat(200);
    const deadlineValue = toLocalDatetimeInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    // 1. Supervisor creates a milestone with 120-char unbroken title and 200-char unbroken description
    await loginAs(page, "supervisor1@cpms.test");
    await page.locator(".card").filter({ hasText: "Team Alpha" }).getByRole("link", { name: "Open team" }).click();
    await expect(page).toHaveURL(/\/supervisor\/teams\/\d+/);
    await expect(page.getByRole("heading", { name: "Team Alpha" })).toBeVisible();

    await page.getByLabel("Title").fill(longTitle);
    await page.getByLabel("Description").fill(longDesc);
    await page.getByLabel("Deadline").fill(deadlineValue);
    await page.getByRole("button", { name: "Create milestone" }).click();

    // 2. Verify supervisor team view wraps without horizontal overflow
    const milestoneItem = page.locator(".milestone-list li").filter({ hasText: longTitle });
    await expect(milestoneItem).toBeVisible();
    await expect(milestoneItem.getByText(longDesc)).toBeVisible();
    await assertNoCardOverflow(page);

    // 3. Verify supervisor milestone detail view wraps without horizontal overflow
    await milestoneItem.getByRole("link", { name: longTitle }).click();
    await expect(page).toHaveURL(/\/supervisor\/milestones\/(\d+)/);
    const milestoneId = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { name: longTitle })).toBeVisible();
    await expect(page.getByText(longDesc)).toBeVisible();
    await assertNoCardOverflow(page);
    await logout(page);

    // 4. Verify student dashboard wraps without horizontal overflow
    await loginAs(page, "student1@cpms.test");
    await expect(page.getByRole("heading", { name: "Student Dashboard" })).toBeVisible();
    const studentMilestoneLink = page.getByRole("link", { name: longTitle });
    await expect(studentMilestoneLink).toBeVisible();
    await assertNoCardOverflow(page);

    // 5. Verify student milestone page + submission with long unbroken strings wrap cleanly
    await studentMilestoneLink.click();
    await expect(page).toHaveURL(new RegExp(`/student/milestones/${milestoneId}`));
    await expect(page.getByRole("heading", { name: longTitle })).toBeVisible();

    await page.getByLabel("Submission title").fill(longSubTitle);
    await page.getByLabel("Description").fill(longDesc);
    await page.getByLabel("Link").fill(longSubLink);
    await page.getByRole("button", { name: "Submit work" }).click();

    const subCard = page.locator(".submission-item").filter({ hasText: `Version 1: ${longSubTitle}` });
    await expect(subCard).toBeVisible();
    await assertNoCardOverflow(page);
    await logout(page);

    // 6. Verify supervisor feedback comment with long unbroken string wraps cleanly
    await loginAs(page, "supervisor1@cpms.test");
    await page.goto(`/supervisor/milestones/${milestoneId}`);
    const supSubCard = page.locator(".submission-item").filter({ hasText: `Version 1: ${longSubTitle}` });
    await expect(supSubCard).toBeVisible();

    await supSubCard.getByLabel("Feedback for version 1").fill(longFeedback);
    await supSubCard.getByRole("button", { name: "Add feedback" }).click();
    await expect(supSubCard.getByText(longFeedback)).toBeVisible();
    await assertNoCardOverflow(page);
    await logout(page);
  });
});
