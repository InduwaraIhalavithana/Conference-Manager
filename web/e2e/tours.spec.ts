import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

// The verified test organizer made by `uv run python -m scripts.e2e_account` (api/). CI sets both variables.
const EMAIL = process.env.E2E_ORGANIZER_EMAIL ?? "e2e.organizer@example.com";
const PASSWORD = process.env.E2E_ORGANIZER_PASSWORD ?? "";

async function seriousAxeIssues(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

/** Opens the page's guide, walks every step with Next, and checks focus goes back to the button. */
async function walkTour(page: Page, firstTitle: string) {
  const button = page.getByRole("button", { name: /Need help\?/ }).filter({ visible: true });
  await button.click();
  const guide = page.getByRole("dialog");
  await expect(guide.getByRole("heading", { name: firstTitle })).toBeVisible();
  expect(await seriousAxeIssues(page)).toEqual([]);
  const [, total] = (await guide.getByText(/^\d+ \/ \d+$/).innerText()).split(" / ").map(Number);
  for (let i = 1; i < total; i++) await guide.getByRole("button", { name: "Next" }).click();
  await guide.getByRole("button", { name: "Done" }).click();
  await expect(guide).toHaveCount(0);
  await expect(button).toBeFocused();
}

test("the public conference page has a guide", async ({ page }) => {
  await page.goto("/en/c/spike-colombo-tech-summit");
  await walkTour(page, "Register");
});

test("the guide closes with Escape and works on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/c/spike-colombo-tech-summit");
  await page.getByRole("button", { name: /Need help\?/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test.describe("organizer guides and the check-in picker", () => {
  test.skip(!PASSWORD, "Set E2E_ORGANIZER_PASSWORD (see scripts/e2e_account.py)");

  test("dashboard guide, and Check-in in the sidebar lists conferences to check in for", async ({ page }) => {
    // Sign-in allows 10 tries a minute per address, and the earlier spec files sign in many times in a row,
    // so a refusal here means "wait for the minute to pass", not a failure.
    test.slow();
    await page.goto("/en/dashboard");
    await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
    await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
    const signIn = page.locator("main").getByRole("button", { name: "Sign in" });
    await signIn.click();
    const limited = page.getByRole("alert").filter({ hasText: "Too many attempts" });
    // The dashboard greets by name ("Welcome back, Eesha"); the sign-in page's own heading is just "Welcome back".
    await expect(page.getByRole("heading", { level: 1, name: /^Welcome back, / }).or(limited)).toBeVisible();
    if (await limited.isVisible()) {
      await page.waitForTimeout(61_000);
      await signIn.click();
    }
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await walkTour(page, "Your numbers");

    await page.getByRole("navigation", { name: "My Dashboard" }).getByRole("link", { name: "Check-in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard\/check-in$/);
    await expect(page.getByRole("heading", { level: 2, name: "Choose a conference" })).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);
    const desk = page.getByRole("link", { name: /Open check-in desk/ }).first();
    if (await desk.count()) {
      await desk.click();
      await expect(page.getByRole("heading", { name: "Scan QR tickets" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "My Dashboard" }).getByRole("link", { name: "Check-in" })).toHaveAttribute("aria-current", "page");
    } else {
      await expect(page.getByRole("region", { name: "Choose a conference" }).getByText("No upcoming conferences")).toBeVisible();
    }
  });
});
