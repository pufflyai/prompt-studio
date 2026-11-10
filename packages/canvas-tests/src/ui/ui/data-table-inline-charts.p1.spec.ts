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
  await expect(comparison.getByText("Base", { exact: true })).toBeVisible();
  await expect(comparison).toHaveCSS("height", "64px");
  await preview.getByRole("button", { name: "Display settings", exact: true }).click();
  await preview.getByRole("button", { name: "Row height Tall", exact: true }).click();
  await preview.getByRole("menuitem", { name: "Compact", exact: true }).click();
  await preview.getByRole("button", { name: "Display settings", exact: true }).click();
  await expect(comparison).toHaveCSS("height", "24px");
  await expect(comparison.getByText("Base", { exact: true })).toBeHidden();
  await expect(comparison.locator("rect").first()).toBeVisible();
  await expect(sparkline).toBeVisible();
  await preview.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(preview.getByRole("img", { name: "Base and head: Base: 0 MB, Head: 0 MB", exact: true })).toBeVisible();
});
