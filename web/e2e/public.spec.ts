import { expect, test } from "@playwright/test";

const SLUG = "spike-kurunegala-ai-day";

test("the skip link is the first stop for keyboard users and jumps to the content", async ({ page }) => {
  await page.goto("/en");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("switching language keeps the page and changes the text", async ({ page }) => {
  await page.goto("/en/about");
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: /සිංහල/ }).click();
  await expect(page).toHaveURL(/\/si\/about$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "si");
});

test("browse filters live in the address bar", async ({ page }) => {
  await page.goto("/en/conferences?category=health");
  await expect(page.getByRole("heading", { name: "Kandy Health Forum" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kurunegala AI Day" })).toHaveCount(0);
});

test("an attendee registers, opens the ticket and cancels it", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto(`/en/c/${SLUG}`);
  const panel = page.locator("aside");
  await panel.getByRole("textbox", { name: "Name" }).fill("E2E Attendee");
  await panel.getByRole("textbox", { name: "Email address" }).fill(email);
  await panel.getByRole("button", { name: "Register now" }).click();
  await expect(panel.getByText("Almost there: confirm your email")).toBeVisible();

  await panel.getByRole("link", { name: "Open ticket" }).click();
  await expect(page).toHaveURL(/\/en\/ticket\//);
  await expect(page.getByText("Waiting for email confirmation").first()).toBeVisible();

  // A wrong code is refused and says how many tries are left (the real code only goes to the inbox).
  await page.getByRole("textbox", { name: "Enter the 6-digit code" }).fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Tries left" })).toBeVisible();

  await page.getByRole("button", { name: "Cancel registration" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel registration" }).click();
  await expect(page.getByText("Registration cancelled").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel registration" })).toHaveCount(0);
});

test("an unknown ticket says so instead of failing", async ({ page }) => {
  await page.goto("/en/ticket/NO-SUCH-TICKET");
  await expect(page.getByRole("heading", { name: "Ticket not found" })).toBeVisible();
});

test("the contact form sends a message", async ({ page }) => {
  await page.goto("/en/contact");
  await page.getByLabel("Your name").fill("E2E Visitor");
  await page.getByLabel("Your email").fill("e2e-visitor@example.com");
  await page.getByText("Technical").click();
  await page.getByLabel("Message").fill("This message comes from the end-to-end tests.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
});

test("search engines get a sitemap, robots rules and language alternates", async ({ page, request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`/c/${SLUG}`);
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /*/ticket/");
  await page.goto(`/en/c/${SLUG}`);
  await expect(page.locator('link[rel="alternate"][hreflang="ta"]')).toHaveAttribute("href", new RegExp(`/ta/c/${SLUG}$`));
});
