import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_ORGANIZER_EMAIL ?? "e2e.organizer@example.com";
const PASSWORD = process.env.E2E_ORGANIZER_PASSWORD ?? "";

async function signIn(page: Page, next: string) {
  await page.goto(next);
  await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.locator("main").getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
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
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    // Leaflet's own zoom controls and tiles are outside our markup.
    .exclude(".leaflet-container")
    .analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

test.describe("conference editor", () => {
  test.skip(!PASSWORD, "Set E2E_ORGANIZER_PASSWORD (see scripts/e2e_account.py)");
  test.slow();

  test("an organizer builds and publishes a conference, and sees who registered", async ({ page, browser }) => {
    const title = `E2E Summit ${Date.now()}`;
    await signIn(page, "/en/dashboard/conferences/new");
    expect(await seriousAxeIssues(page)).toEqual([]);

    await page.getByRole("textbox", { name: "Title (English) *" }).fill(title);
    await page.getByRole("textbox", { name: "Short summary (English)" }).fill("Built by the end-to-end tests.");
    await page.getByLabel("Starts").fill("2030-05-20T09:00");
    await page.getByLabel("Ends").fill("2030-05-20T17:00");
    await page.getByRole("textbox", { name: "City" }).fill("Kandy");
    await page.getByRole("button", { name: "Create conference" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    const editorUrl = page.url();

    // Publishing is blocked until there is a seat limit.
    await page.getByRole("tab", { name: /Publish/ }).click();
    await expect(page.getByText("Set a seat limit.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeDisabled();

    await page.getByRole("tab", { name: /Details/ }).click();
    await page.getByRole("spinbutton", { name: "Seat limit" }).fill("50");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved").first()).toBeVisible();

    await page.getByRole("tab", { name: /Speakers/ }).click();
    await page.getByRole("button", { name: "Add speaker" }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: "Name" }).fill("Dr. Test Speaker");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Dr. Test Speaker")).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);

    await page.getByRole("tab", { name: /Agenda/ }).click();
    await page.getByRole("button", { name: "Add session" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Title (English) *" }).fill("Opening keynote");
    await dialog.getByRole("combobox", { name: "Type" }).selectOption("KEYNOTE");
    await dialog.getByLabel("Start time").fill("09:30");
    await dialog.getByLabel("End time").fill("10:15");
    await dialog.getByRole("checkbox", { name: "Dr. Test Speaker" }).check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Opening keynote")).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);

    await page.getByRole("tab", { name: /Publish/ }).click();
    await expect(page.getByText("Everything needed is in place.")).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByRole("button", { name: "Move back to draft" })).toBeVisible();

    // A visitor (no sign-in) registers on the public page.
    await page.getByRole("link", { name: "View public page" }).click();
    const publicPage = await page.waitForEvent("popup").catch(() => null);
    const visitor = await browser.newContext();
    const pub = await visitor.newPage();
    const slugUrl = publicPage ? publicPage.url() : (await page.getByRole("link", { name: "View public page" }).getAttribute("href")) ?? "";
    await publicPage?.close();
    await pub.goto(slugUrl);
    await expect(pub.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(pub.getByText("Opening keynote")).toBeVisible();
    const panel = pub.locator("aside");
    await panel.getByRole("textbox", { name: "Name" }).fill("Visitor Person");
    await panel.getByRole("textbox", { name: "Email address" }).fill(`e2e-visitor-${Date.now()}@example.com`);
    await panel.getByRole("button", { name: "Register now" }).click();
    await expect(panel.getByText("Almost there: confirm your email")).toBeVisible();
    await visitor.close();

    await page.goto(`${editorUrl}/attendees`);
    await expect(page.getByRole("cell", { name: /^Visitor Person/ })).toBeVisible();
    await page.getByRole("tab", { name: /Not confirmed/ }).click();
    await expect(page.getByRole("cell", { name: /^Visitor Person/ })).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);

    await page.goto("/en/dashboard/conferences");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);
  });
});
