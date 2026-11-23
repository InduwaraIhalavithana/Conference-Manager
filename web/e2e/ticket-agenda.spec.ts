import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

// The verified test organizer made by `uv run python -m scripts.e2e_account` (api/). CI sets both variables.
const EMAIL = process.env.E2E_ORGANIZER_EMAIL ?? "e2e.organizer@example.com";
const PASSWORD = process.env.E2E_ORGANIZER_PASSWORD ?? "";

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

test.describe("My agenda on the ticket page", () => {
  test.skip(!PASSWORD, "Set E2E_ORGANIZER_PASSWORD (see scripts/e2e_account.py)");

  test("a ticket holder saves sessions to their agenda, and feedback waits for check-in", async ({ page }) => {
    await page.goto("/en/dashboard");
    await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
    await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
    await page.locator("main").getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    const conf = (
      await gql<{ createConference: { id: string; slug: string } }>(
        page,
        `mutation($i: ConferenceInput!) { createConference(input: $i) { ... on Conference { id slug } } }`,
        { i: { title: { en: `E2E Agenda ${Date.now()}` }, startsAt: "2030-07-01T09:00:00+05:30", endsAt: "2030-07-01T17:00:00+05:30", city: "Kandy", capacity: 20 } },
      )
    ).createConference;
    await gql(page, `mutation($c: ID!, $i: SessionInput!) { upsertSession(conferenceId: $c, input: $i) { __typename } }`, {
      c: conf.id,
      i: { title: { en: "Morning talk" }, startsAt: "2030-07-01T10:00:00+05:30", endsAt: "2030-07-01T11:00:00+05:30", room: "Hall A" },
    });
    await gql(page, `mutation($id: ID!) { publishConference(id: $id) { __typename } }`, { id: conf.id });
    const ticket = (
      await gql<{ registerForConference: { ticketCode: string } }>(
        page,
        `mutation($s: String!, $i: AttendeeInput!) { registerForConference(slug: $s, input: $i) { ... on Registered { ticketCode } } }`,
        { s: conf.slug, i: { name: "Agenda Ana", email: `e2e-agenda-${Date.now()}@example.com`, lang: "EN" } },
      )
    ).registerForConference.ticketCode;

    await page.goto(`/en/ticket/${ticket}`);
    const agenda = page.getByRole("region", { name: "My agenda" });
    await expect(agenda.getByText("Morning talk")).toBeVisible();
    await agenda.getByRole("button", { name: "Save to my agenda: Morning talk" }).click();
    await expect(agenda.getByRole("button", { name: "Saved (1)" })).toBeVisible();
    await expect(agenda.getByRole("button", { name: /^Add to calendar: Morning talk/ })).toBeVisible();

    await page.reload(); // saved on the server, and the saved list shows first
    await expect(agenda.getByRole("button", { name: "Saved (1)" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "Your feedback" })).toHaveCount(0); // not checked in yet

    await page.waitForLoadState("load");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

    await agenda.getByRole("button", { name: "Remove from my agenda: Morning talk" }).click();
    await expect(agenda.getByRole("button", { name: "Saved (0)" })).toBeVisible();
  });
});
