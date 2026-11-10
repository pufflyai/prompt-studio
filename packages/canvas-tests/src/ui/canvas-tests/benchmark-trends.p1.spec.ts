import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: chart focus must not crash Trends and prevent returning to its charts.
test("focused benchmark trends remain usable when returning to charts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const preview = await openCanvasPreview(
    page,
    ".pstdio/extensions/pstdio-dev/src/trends/trends.canvas.tsx#OnePlatform",
  );
  const chart = preview.getByRole("img", { name: "Cold start across releases, median per platform" });
  await chart.focus();
  await chart.press("ArrowRight");
  await expect(preview.locator('[aria-live="polite"]').first()).toContainText("Linux x64");
  await preview.getByRole("button", { name: "Show table", exact: true }).click();
  await expect(chart).toBeHidden();
  await preview.getByRole("button", { name: "Show charts", exact: true }).click();
  await expect(chart).toBeVisible();
  expect(errors).toEqual([]);
});
