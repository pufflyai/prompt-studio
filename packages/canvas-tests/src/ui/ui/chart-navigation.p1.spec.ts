import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: changing the renderer must preserve meaningful percentage comparisons.
test("statistics keep their fixed percentage scale and expose values on keyboard focus", async ({ page }) => {
  const preview = await openCanvasPreview(page, "packages/ui/src/components/charts/charts.canvas.tsx#Statistics");
  const low = preview.getByRole("img", { name: "25% share" });
  const high = preview.getByRole("img", { name: "75% share" });
  const lowBar = low.locator(".ts-chart__marks :is(rect, path)").first();
  const highBar = high.locator(".ts-chart__marks :is(rect, path)").first();
  await expect(lowBar).toBeVisible();
  const ratio =
    (await highBar.evaluate((element) => (element as SVGGraphicsElement).getBBox().width)) /
    (await lowBar.evaluate((element) => (element as SVGGraphicsElement).getBBox().width));
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
  const bar = preview
    .getByRole("img", { name: "Columns", exact: true })
    .locator(".ts-chart__marks :is(rect, path)")
    .first();
  await expect(bar).toHaveCSS("fill", "rgb(212, 187, 255)");
  await expect(preview.getByRole("img")).toHaveCount(34);
  const shell = page.frameLocator("[data-verification-host]");
  await shell.getByRole("button", { name: "Theme for Custom palette", exact: true }).click();
  await shell.getByRole("menuitem", { name: "Prompt Dark", exact: true }).click();
  await expect(bar).toHaveCSS("fill", "rgb(138, 63, 252)");
  await shell.getByRole("button", { name: "Theme for Custom palette", exact: true }).click();
  await shell.getByRole("menuitem", { name: "Prompt Light", exact: true }).click();
  await expect(bar).toHaveCSS("fill", "rgb(105, 41, 196)");
});

// Critical: every categorical series needs a distinct color beyond the first seven.
test("Carbon palette keeps fourteen distinct theme colors", async ({ page }) => {
  const preview = await openCanvasPreview(page, "packages/ui/src/components/charts/visualizations.canvas.tsx#Palettes");
  const marks = preview
    .getByRole("img", { name: "Carbon categorical palette", exact: true })
    .locator(".ts-chart__marks :is(rect, path)");
  await expect(marks).toHaveCount(14);
  const colors = await marks.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).fill));
  expect(new Set(colors).size).toBe(14);
  await expect(marks.first()).toHaveCSS("fill", "rgb(105, 41, 196)");
  const shell = page.frameLocator("[data-verification-host]");
  await shell.getByRole("button", { name: "Theme for Palettes", exact: true }).click();
  await shell.getByRole("menuitem", { name: "Prompt Dark", exact: true }).click();
  await expect(marks.first()).toHaveCSS("fill", "rgb(138, 63, 252)");
  const darkColors = await marks.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).fill));
  expect(new Set(darkColors).size).toBe(14);
});
