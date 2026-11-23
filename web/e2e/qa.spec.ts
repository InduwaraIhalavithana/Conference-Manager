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

async function seriousAxeIssues(page: Page): Promise<string[]> {
  await page.waitForLoadState("load");
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

test.describe("live Q&A", () => {
  test.skip(!PASSWORD, "Set E2E_ORGANIZER_PASSWORD (see scripts/e2e_account.py)");

  test("organizers moderate per session; only confirmed tickets can join", async ({ page }) => {
    await page.goto("/en/dashboard");
    await page.getByRole("textbox", { name: "Email address" }).fill(EMAIL);
    await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
    await page.locator("main").getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);

    const conf = (
      await gql<{ createConference: { id: string; slug: string } }>(
        page,
        `mutation($i: ConferenceInput!) { createConference(input: $i) { ... on Conference { id slug } } }`,
        { i: { title: { en: `E2E Q&A ${Date.now()}` }, startsAt: "2030-08-01T09:00:00+05:30", endsAt: "2030-08-01T17:00:00+05:30", city: "Galle", capacity: 20 } },
      )
    ).createConference;
    await gql(page, `mutation($c: ID!, $i: SessionInput!) { upsertSession(conferenceId: $c, input: $i) { __typename } }`, {
      c: conf.id,
      i: { title: { en: "Keynote" }, startsAt: "2030-08-01T10:00:00+05:30", endsAt: "2030-08-01T11:00:00+05:30" },
    });
    await gql(page, `mutation($id: ID!) { publishConference(id: $id) { __typename } }`, { id: conf.id });

    // The organizer's moderation page: reached from the attendees page, live, with nothing waiting yet.
    await page.goto(`/en/dashboard/conferences/${conf.id}/attendees`);
    await page.getByRole("link", { name: "Live Q&A" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/dashboard/conferences/${conf.id}/qa$`));
    await expect(page.getByRole("combobox", { name: "Session" })).toContainText("Keynote");
    await expect(page.getByText("Nothing waiting.")).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);

    // A ticket that was never confirmed gets no Q&A button, and the page explains why.
    const ticket = (
      await gql<{ registerForConference: { ticketCode: string } }>(
        page,
        `mutation($s: String!, $i: AttendeeInput!) { registerForConference(slug: $s, input: $i) { ... on Registered { ticketCode } } }`,
        { s: conf.slug, i: { name: "Quiz Qadir", email: `e2e-qa-${Date.now()}@example.com`, lang: "EN" } },
      )
    ).registerForConference.ticketCode;
    await page.goto(`/en/ticket/${ticket}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Live Q&A" })).toHaveCount(0);
    await page.goto(`/en/ticket/${ticket}/qa`);
    await expect(page.getByText("Live Q&A is for people with a confirmed seat")).toBeVisible();
    expect(await seriousAxeIssues(page)).toEqual([]);
  });
});
