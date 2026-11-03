import { test, expect } from "@playwright/test";

// Skeleton smoke test: the client loads and can reach the API through the proxy.
test("app shell loads and reports API status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Course Project Management System" })).toBeVisible();
  await expect(page.getByTestId("api-status")).toHaveText("API: ok");
});
