import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: returning from a tabbed page must not split Main between duplicate page views.
test("returning from Canvas keeps one Home view before and after its retention expires", async ({ page }) => {
  await page.clock.install();
  const preview = await openCanvasPreview(page, "packages/e2e/src/fixtures/page-return.canvas.tsx#PageReturn");
  const main = preview.locator('[data-workbench-panel="main"]');
  const draft = main.getByRole("textbox", { name: "Home draft" });
  await draft.fill("Keep my Home state");
  await preview.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(main.getByText("Canvas content", { exact: true })).toBeVisible();
  await expect(draft).toBeHidden();
  await preview.getByRole("button", { name: "Home", exact: true }).click();
  await expect(main.locator('[data-workbench-view="home"]')).toHaveCount(1);
  await expect(draft).toHaveValue("Keep my Home state");
  await expect(main.locator("[data-workbench-instance]:visible")).toHaveCount(1);
  await preview.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(main.getByText("Canvas content", { exact: true })).toBeVisible();
  await page.clock.fastForward(31 * 60_000);
  await expect(main.locator('[data-workbench-view="home"]')).toHaveCount(0);
  await preview.getByRole("button", { name: "Home", exact: true }).click();
  await expect(main.locator('[data-workbench-view="home"]')).toHaveCount(1);
  await expect(draft).toHaveValue("");
  await expect(main.locator("[data-workbench-instance]:visible")).toHaveCount(1);
});
