import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: changing the renderer must preserve meaningful percentage comparisons.
test("statistics keep their fixed percentage scale and expose values on keyboard focus", async ({ page }) => {
  const preview = await openCanvasPreview(page, "packages/ui/src/components/charts/charts.canvas.tsx#Statistics");
  const low = preview.getByRole("img", { name: "25% share" });
  const high = preview.getByRole("img", { name: "75% share" });
  const lowBar = low.locator(".ts-chart__marks rect").first();
  const highBar = high.locator(".ts-chart__marks rect").first();
  await expect(lowBar).toBeVisible();
  const ratio = Number(await highBar.getAttribute("width")) / Number(await lowBar.getAttribute("width"));
  expect(ratio).toBeCloseTo(3, 1);
  await low.focus();
  await low.press("ArrowRight");
  await expect(preview.getByText("Value: 25%", { exact: true })).toBeVisible();
  const tooltip = preview.locator("[data-chart-tooltip]");
  await expect(tooltip).toHaveCSS("border-top-style", "solid");
  await expect(tooltip).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

// Critical: users must be able to select dependency-chart tasks without a pointer.
test("Gantt keyboard navigation follows grouped row order and selects a task", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/charts/charts.canvas.tsx#GanttDependencies",
  );
  const chart = preview.getByRole("img", { name: "Project forecast with dependencies" });
  await chart.focus();
  await chart.press("Home");
  await chart.press("ArrowDown");
  await chart.press("Enter");
  await expect(preview.getByRole("status").filter({ hasText: "Selected schema" })).toBeVisible();
});
