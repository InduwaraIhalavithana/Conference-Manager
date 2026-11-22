import AxeBuilder from "@axe-core/playwright";
import { type Browser, type Page, expect, test } from "@playwright/test";

// The test admin and organizer made by `uv run python -m scripts.e2e_account` (api/). CI sets all four variables.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e.admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const ORG_EMAIL = process.env.E2E_ORGANIZER_EMAIL ?? "e2e.organizer@example.com";
const ORG_PASSWORD = process.env.E2E_ORGANIZER_PASSWORD ?? "";

async function signInAdmin(page: Page, next = "/en/admin") {
  await page.goto(next);
  await expect(page).toHaveURL(/\/en\/admin\/login\?next=/);
  await page.getByRole("textbox", { name: "Email address" }).fill(ADMIN_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(ADMIN_PASSWORD);
  await page.locator("main").getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Admin area" })).toBeVisible();
}

async function signInOrganizer(page: Page, next = "/en/dashboard") {
  await page.goto(next);
  await expect(page).toHaveURL(/\/en\/login\?next=/);
  await page.getByRole("textbox", { name: "Email address" }).fill(ORG_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(ORG_PASSWORD);
  await page.locator("main").getByRole("button", { name: "Sign in" }).click();
}

/** A second, separate browser session, so the admin and the organizer can be signed in side by side. */
async function newPage(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

async function seriousAxeIssues(page: Page): Promise<string[]> {
  await page.waitForLoadState("load");
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

test.describe("admin area", () => {
  test.skip(!ADMIN_PASSWORD || !ORG_PASSWORD, "Set E2E_ADMIN_PASSWORD and E2E_ORGANIZER_PASSWORD (see api/scripts/e2e_account.py).");

  test("every admin page loads with no serious accessibility problems", async ({ page }) => {
    await signInAdmin(page);
    const pages = [
      ["/en/admin", "Administration"],
      ["/en/admin/organizers", "Organizers"],
      ["/en/admin/conferences", "Conferences"],
      ["/en/admin/inbox", "Inbox"],
      ["/en/admin/activity", "Activity"],
      ["/en/admin/system", "System"],
    ] as const;
    for (const [path, heading] of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(await seriousAxeIssues(page), path).toEqual([]);
    }
    await expect(page.getByText("All systems running")).toBeVisible();
  });

  test("organizers cannot open the admin area", async ({ page }) => {
    await signInOrganizer(page);
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await page.goto("/en/admin/organizers");
    await expect(page).toHaveURL(/\/en\/dashboard$/);
  });

  test("a contact message is answered from the inbox", async ({ page, browser }) => {
    const stamp = Date.now();
    const visitor = await newPage(browser);
    await visitor.goto("/en/contact");
    await visitor.getByRole("textbox", { name: "Your name" }).fill("Visitor E2E");
    await visitor.getByRole("textbox", { name: "Your email" }).fill(`visitor-${stamp}@example.com`);
    await visitor.getByRole("textbox", { name: "Message" }).fill(`Question number ${stamp} about group tickets.`);
    await visitor.getByRole("button", { name: "Send message" }).click();
    await expect(visitor.getByRole("heading", { level: 2 }).filter({ hasText: /sent|thank/i })).toBeVisible();

    await signInAdmin(page, "/en/admin/inbox");
    const item = page.getByRole("listitem").filter({ hasText: `Question number ${stamp}` });
    await item.getByRole("button", { name: "Reply" }).click();
    await item.getByRole("textbox", { name: "Reply" }).fill("Yes, groups of ten get a discount.");
    await item.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText("Reply sent")).toBeVisible();
    await expect(item).toHaveCount(0);
    await page.getByRole("tab", { name: "Resolved" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: `Question number ${stamp}` })).toBeVisible();
  });

  test("organizer feedback gets an answer the organizer can read", async ({ page, browser }) => {
    const subject = `Feature idea ${Date.now()}`;
    const organizer = await newPage(browser);
    await signInOrganizer(organizer, "/en/dashboard/help");
    await expect(organizer.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
    expect(await seriousAxeIssues(organizer)).toEqual([]);
    await organizer.getByRole("textbox", { name: "Subject" }).fill(subject);
    await organizer.getByRole("textbox", { name: "Message" }).fill("Please let us import speakers from a spreadsheet.");
    await organizer.getByRole("button", { name: "Send message" }).click();
    await expect(organizer.getByText("Thank you, your message was sent")).toBeVisible();

    await signInAdmin(page, "/en/admin/inbox");
    await page.getByRole("tab", { name: "Organizer feedback" }).click();
    const item = page.getByRole("listitem").filter({ hasText: subject });
    await item.getByRole("button", { name: "Reply" }).click();
    await item.getByRole("textbox", { name: "Reply" }).fill("Thanks, it is on our list.");
    await item.getByRole("button", { name: "Send reply" }).click();
    await expect(page.getByText("Reply sent")).toBeVisible();

    await organizer.reload();
    const mine = organizer.getByRole("listitem").filter({ hasText: subject });
    await expect(mine.getByText("Replied")).toBeVisible();
    await expect(mine.getByText("Thanks, it is on our list.")).toBeVisible();
  });

  test("a suspended organizer cannot sign in until restored", async ({ page, browser }) => {
    await signInAdmin(page, "/en/admin/organizers");
    const row = page.getByRole("listitem").filter({ hasText: ORG_EMAIL });
    const confirm = page.getByRole("alertdialog").or(page.getByRole("dialog"));

    await row.getByRole("button", { name: /^Actions/ }).click();
    await page.getByRole("menuitem", { name: "Suspend" }).click();
    await confirm.getByRole("button", { name: "Suspend" }).click();
    await expect(row.getByText("Suspended")).toBeVisible();
    try {
      const organizer = await newPage(browser);
      await signInOrganizer(organizer);
      await expect(organizer.locator("main").getByRole("alert")).toBeVisible();
      await expect(organizer).toHaveURL(/\/en\/login/);
    } finally {
      // Always restore, or every later organizer test fails.
      await row.getByRole("button", { name: /^Actions/ }).click();
      await page.getByRole("menuitem", { name: "Restore" }).click();
      await confirm.getByRole("button", { name: "Restore" }).click();
      await expect(row.getByText("Suspended")).toHaveCount(0);
    }
    const organizer = await newPage(browser);
    await signInOrganizer(organizer);
    await expect(organizer).toHaveURL(/\/en\/dashboard$/);
  });
});
