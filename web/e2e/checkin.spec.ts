import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_ORGANIZER_EMAIL ?? "e2e.organizer@example.com";
const PASSWORD = process.env.E2E_ORGANIZER_PASSWORD ?? "";

async function signIn(page: Page) {
  await page.goto("/en/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.locator("main").getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/dashboard$/);
}

/** GraphQL from inside the signed-in page (same cookies and CSRF header as the app). */
async function gql<T>(page: Page, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  return page.evaluate(
    async ({ query, variables }) => {
      const csrf = document.cookie.split("; ").find((c) => c.startsWith("cm_csrf="))?.split("=")[1] ?? "";
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ query, variables }),
      });
      return (await res.json()).data;
    },
    { query, variables },
  );
}

async function publishedConference(page: Page): Promise<{ id: string; slug: string }> {
  const created = await gql<{ createConference: { id: string; slug: string } }>(
    page,
    `mutation($i: ConferenceInput!) { createConference(input: $i) { ... on Conference { id slug } } }`,
    { i: { title: { en: `E2E Desk ${Date.now()}` }, startsAt: "2030-06-01T09:00:00+05:30", endsAt: "2030-06-01T17:00:00+05:30", city: "Galle", capacity: 20 } },
  );
  await gql(page, `mutation($id: ID!) { publishConference(id: $id) { __typename } }`, { id: created.createConference.id });
  return created.createConference;
}

async function register(page: Page, slug: string, name: string): Promise<string> {
  const data = await gql<{ registerForConference: { ticketCode: string } }>(
    page,
    `mutation($s: String!, $i: AttendeeInput!) { registerForConference(slug: $s, input: $i) { ... on Registered { ticketCode } } }`,
    { s: slug, i: { name, email: `e2e-desk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, lang: "EN" } },
  );
  return data.registerForConference.ticketCode;
}

test.describe("check-in desk and analytics", () => {
  test.skip(!PASSWORD, "Set E2E_ORGANIZER_PASSWORD (see scripts/e2e_account.py)");
  test.slow();

  test("the desk answers typed codes, keeps scans offline and syncs them", async ({ page, context }) => {
    await signIn(page);
    const conf = await publishedConference(page);
    const ticket = await register(page, conf.slug, "Offline Olivia");

    await page.goto(`/en/dashboard/conferences/${conf.id}/check-in`);
    await expect(page.getByRole("heading", { name: "Scan QR tickets" })).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();

    // Unconfirmed tickets are refused with a warning (the code from the email was never entered).
    const field = page.getByRole("textbox", { name: "Type a ticket code" });
    await field.fill(ticket.toLowerCase().replace(/(.{4})/, "$1-"));
    await field.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Ticket not accepted" })).toContainText("confirmation email");

    await field.fill("NOSUCHTICKET");
    await field.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Ticket not accepted" })).toBeVisible();

    // Offline: the scan waits on the device, then goes through when the connection is back.
    await context.setOffline(true);
    await expect(page.getByText("Offline: scans are saved on this device")).toBeVisible();
    await field.fill(ticket);
    await field.press("Enter");
    await expect(page.getByText("1 waiting to sync")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText("1 offline scans synced")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("1 waiting to sync")).toHaveCount(0);

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`).slice(0, 3).join(" | ")}`)).toEqual([]);
  });

  test("analytics show a conference and the overview", async ({ page }) => {
    await signIn(page);
    const conf = await publishedConference(page);
    await register(page, conf.slug, "Chart Person");
    await page.goto(`/en/dashboard/analytics?conference=${conf.id}`);
    await expect(page.getByRole("region", { name: "Registrations by day" }).locator(".recharts-wrapper")).toBeVisible();
    await expect(page.getByText("Seats filled")).toBeVisible();
    await page.getByRole("combobox", { name: "Conference" }).selectOption("");
    await expect(page.getByText("Sign-ups in the last 30 days").first()).toBeVisible();

    await page.waitForLoadState("load");
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? ""}`).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
});
