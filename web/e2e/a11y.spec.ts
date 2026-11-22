import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  "/en",
  "/si",
  "/ta",
  "/en/conferences",
  "/en/conferences?view=map",
  "/en/c/spike-colombo-tech-summit",
  "/en/about",
  "/en/contact",
  "/en/privacy",
  "/ta/terms",
  "/en/ticket/NO-SUCH-TICKET",
];

for (const theme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`${path} has no serious accessibility problems (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("cm_theme", t), theme);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
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
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
    });
  }
}
