import fs from "node:fs";
import path from "node:path";
import { Page, expect } from "@playwright/test";

function loadSeedPassword(): string {
  if (process.env.SEED_DEMO_PASSWORD) return process.env.SEED_DEMO_PASSWORD;
  try {
    const envPath = path.resolve(process.cwd(), "server/.env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^SEED_DEMO_PASSWORD=(.*)$/m);
      if (match && match[1].trim()) {
        return match[1].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Fall back to default password
  }
  return "demo-password";
}

export const DEMO_PASSWORD = loadSeedPassword();

// Formats a Date using the system's local time components for datetime-local inputs (YYYY-MM-DDTHH:mm).
export function toLocalDatetimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function loginAs(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}
