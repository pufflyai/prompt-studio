import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: table density must not clip chart cells or lose their accessible measurements.
test("inline charts stay readable when table rows change height", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/data-table/data-table-charts.canvas.tsx#Performance",
  );
  const sparkline = preview.getByRole("img", { name: /^History: Run 1: 5,400 ms/ });
  const comparison = preview.getByRole("img", { name: "Base and head: Base: 4,800 ms, Head: 5,300 ms", exact: true });
  await expect(sparkline).toBeVisible();
  await expect(comparison.getByText("Base", { exact: true })).toHaveCount(0);
  await expect(comparison).toHaveCSS("height", "64px");
  await preview.getByRole("button", { name: "Display settings", exact: true }).click();
  await preview.getByRole("button", { name: "Row height Tall", exact: true }).click();
  await preview.getByRole("menuitem", { name: "Compact", exact: true }).click();
  await preview.getByRole("button", { name: "Display settings", exact: true }).click();
  await expect(comparison).toHaveCSS("height", "24px");
  await expect(comparison.getByText("Base", { exact: true })).toHaveCount(0);
  await expect(comparison.locator("path").first()).toBeVisible();
  await expect(sparkline).toBeVisible();
  await preview.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(preview.getByRole("img", { name: "Base and head: Base: 0 MB, Head: 0 MB", exact: true })).toBeVisible();
});

// Critical: measurements hidden by compact rows remain available on hover and keyboard focus.
test("inline chart tooltips expose individual measurements and keyboard summaries", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/data-table/data-table-charts.canvas.tsx#Performance",
  );
  const comparison = preview.getByRole("img", { name: "Base and head: Base: 4,800 ms, Head: 5,300 ms", exact: true });
  const tooltip = preview.locator('[role="tooltip"][data-state="open"]');
  await comparison.locator("path").first().hover();
  await expect(tooltip).toHaveText("Base: 4,800 ms");
  await comparison.locator("path").nth(1).hover();
  await expect(tooltip).toHaveText("Head: 5,300 ms");
  const sparkline = preview.getByRole("img", { name: /^History: Run 1: 5,400 ms/ });
  const plot = sparkline.locator("svg");
  const bounds = await plot.boundingBox();
  if (!bounds) throw new Error("History plot is missing");
  await plot.hover({ position: { x: bounds.width * 0.592, y: bounds.height / 2 } });
  await expect(tooltip).toHaveText("Run 4: not measured");
  await comparison.focus();
  await expect(tooltip).toContainText("Base: 4,800 ms");
  await expect(tooltip).toContainText("Head: 5,300 ms");
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await preview.getByRole("button", { name: "Memory", exact: true }).click();
  const zero = preview.getByRole("img", { name: "Base and head: Base: 0 MB, Head: 0 MB", exact: true });
  await zero.locator("svg").first().hover();
  await expect(tooltip).toHaveText("Base: 0 MB");
});
