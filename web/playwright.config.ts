import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running site (API + web). Locally they use the installed Chrome;
 * CI installs Playwright's Chromium and starts `next start` after seeding the database.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    locale: "en-GB",
    timezoneId: "Asia/Colombo",
    // The app shortens its fade-ins to 1 ms under reduced motion, so the axe checks never see a card half-faded
    // (a tile mid-fade reads as low contrast and failed a tour check once in CI).
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" }, testMatch: /a11y/ },
  ],
});
