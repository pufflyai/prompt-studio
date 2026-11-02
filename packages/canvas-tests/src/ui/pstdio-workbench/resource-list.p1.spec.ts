import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: an SDK resource-list body must reach the native renderer through the workbench host.
test("mount a public resource-list extension in the workbench", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/examples/onboarding/onboarding.canvas.tsx#ResourceList",
  );
  await expect(preview.getByTestId("resource-list-renderer")).toBeVisible();
  await expect(preview.getByRole("option", { name: "Improve search", exact: true })).toBeVisible();
  await expect(preview.getByRole("option", { name: "Check search results", exact: true })).toBeVisible();
});

// Critical: nested resource navigation and Display controls must remain reachable by keyboard.
test("open parent and child resources, collapse groups and hide children", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/kanban-renderer/resource-list-renderer.canvas.tsx#GroupedAndNested",
  );
  const parent = preview.getByRole("option", { name: "Improve search", exact: true });
  await parent.focus();
  await page.keyboard.press("Enter");
  await expect(preview.getByText("Opened Improve search", { exact: false })).toBeVisible();
  const child = preview.getByRole("option", { name: "Check search results", exact: true });
  await child.focus();
  await page.keyboard.press("Enter");
  await expect(preview.getByText("Opened Check search results", { exact: false })).toBeVisible();
  await preview.getByRole("option").filter({ hasText: "This device" }).first().click();
  await expect(child).toBeHidden();
  await preview.getByRole("option").filter({ hasText: "This device" }).first().click();
  await expect(child).toBeVisible();
  await preview.getByRole("button", { name: "Display settings" }).click();
  await expect(preview.getByRole("button", { name: "Board", exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: /Children.*Nested/ }).click();
  await preview.getByRole("menuitem", { name: "Hidden", exact: true }).click();
  await expect(child).toBeHidden();
});
