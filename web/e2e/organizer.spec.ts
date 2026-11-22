import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

// The verified test organizer made by `uv run python -m scripts.e2e_account` (api/). CI sets both variables.
const EMAIL = process.env.E2E_ORGANIZER_EMAIL ?? "e2e.organizer@example.com";
const PASSWORD = process.env.E2E_ORGANIZER_PASSWORD ?? "";

async function signIn(page: Page, next = "/en/dashboard") {
  await page.goto(next);
  await expect(page).toHaveURL(/\/en\/login\?next=/);
  await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.locator("main").getByRole("button", { name: "Sign in" }).click();
}

async function seriousAxeIssues(page: Page): Promise<string[]> {
  // "load", not "networkidle": the notification bell keeps checking in the background.
  await page.waitForLoadState("load");
  // Let entrance animations finish so colours are measured at full opacity (looping ones never end).
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

test.describe("sign-in pages", () => {
  for (const path of ["/en/login", "/en/register", "/en/forgot", "/si/login", "/en/admin/login"]) {
    test(`${path} has no serious accessibility problems`, async ({ page }) => {
      await page.goto(path);
      expect(await seriousAxeIssues(page)).toEqual([]);
    });
  }

  test("private pages send signed-out visitors to the right sign-in page", async ({ page }) => {
    await page.goto("/en/dashboard/settings");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fdashboard%2Fsettings$/);
    await page.goto("/ta/admin");
    await expect(page).toHaveURL(/\/ta\/admin\/login\?next=%2Fta%2Fadmin$/);
  });

  test("sign-up asks for the emailed code", async ({ page }) => {
    await page.goto("/en/register");
    await page.getByRole("textbox", { name: "First name" }).fill("Pat");
    await page.getByRole("textbox", { name: "Last name" }).fill("Signup");
    await page.getByRole("textbox", { name: "Email address" }).fill(`e2e-signup-${Date.now()}@example.com`);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("Long-enough-pass-1");
    await page.getByRole("textbox", { name: "Confirm password" }).fill("Long-enough-pass-2");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "do not match" })).toBeVisible();
    await page.getByRole("textbox", { name: "Confirm password" }).fill("Long-enough-pass-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("textbox", { name: "Enter the 6-digit code" })).toBeVisible();
  });

  test("a wrong password is refused", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
    await page.getByRole("textbox", { name: "Password" }).fill("not-the-password");
    await page.locator("main").getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "not correct" })).toBeVisible();
  });
});

test.describe("organizer area", () => {
  test.skip(!PASSWORD, "Set E2E_ORGANIZER_PASSWORD (see scripts/e2e_account.py)");

  // Several pages and accessibility scans each: slower than one page on a CI machine.
  test.slow();

  test("an organizer signs in, updates their profile and signs out", async ({ page }) => {
    await signIn(page, "/en/dashboard/settings");
    await expect(page).toHaveURL(/\/en\/dashboard\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);

    const organization = `E2E Org ${Date.now()}`;
    await page.getByRole("textbox", { name: "Organisation (Optional)" }).fill(organization);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();

    await page.getByRole("link", { name: "My Dashboard" }).first().click();
    await expect(page.getByRole("heading", { name: /Welcome back, Eesha/ })).toBeVisible();
    await expect(page.getByText(organization).first()).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("the organizer pages have no serious accessibility problems in the light theme", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("cm_theme", "light"));
    await signIn(page);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    for (const path of ["/en/dashboard", "/en/dashboard/settings"]) {
      await page.goto(path);
      await expect(page.locator("html")).not.toHaveClass(/dark/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await seriousAxeIssues(page)).toEqual([]);
    }
  });
});
