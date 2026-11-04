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
test("Gantt keyboard navigation follows ticket row order and selects a task", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/charts/charts.canvas.tsx#GanttDependencies",
  );
  const chart = preview.getByRole("img", { name: "Project forecast with dependencies" });
  await chart.focus();
  await chart.press("Home");
  await chart.press("Enter");
  await expect(preview.locator('[data-ticket-id="schema"]')).toHaveAttribute("data-selected", "true");
});

// Critical: theme changes must preserve chart contrast and contributed series colors.
test("visualization gallery applies light, dark, and contributed chart tokens", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/charts/visualizations.canvas.tsx#CustomPalette",
  );
  const bar = preview.getByRole("img", { name: "Columns", exact: true }).locator(".ts-chart__marks rect").first();
  await expect(bar).toHaveCSS("fill", "rgb(140, 219, 145)");
  await expect(preview.getByRole("img")).toHaveCount(20);
  const shell = page.frameLocator("[data-verification-host]");
  await shell.getByRole("button", { name: "Theme for Custom palette", exact: true }).click();
  await shell.getByRole("menuitem", { name: "Prompt Dark", exact: true }).click();
  await expect(bar).not.toHaveCSS("fill", "rgb(140, 219, 145)");
  const dark = await bar.evaluate((element) => getComputedStyle(element).fill);
  await shell.getByRole("button", { name: "Theme for Custom palette", exact: true }).click();
  await shell.getByRole("menuitem", { name: "Prompt Light", exact: true }).click();
  await expect(bar).not.toHaveCSS("fill", dark);
});
