import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: the production build must expose older history and refresh an already visible collection.
test("compiled trees project accepted roots, pages and subsequent row changes", async ({ page }) => {
  const frame = await openCanvasPreview(
    page,
    "packages/e2e/src/fixtures/tree-compiled-projection.canvas.tsx#CompiledHistory",
  );
  await frame.getByRole("button", { name: "Accept history", exact: true }).click();
  const first = frame.getByRole("option", { name: "Account running", exact: true });
  await expect(first).toBeVisible();
  await first.press("End");
  await expect(frame.locator('[data-tree-list-row="continuation"]')).toBeAttached();
  await frame.getByRole("button", { name: "Finish page", exact: true }).click();
  await expect(frame.getByRole("option", { name: "Older session", exact: true })).toBeAttached();
  await frame.getByRole("button", { name: "Toggle account", exact: true }).click();
  await frame.locator("[data-scope=scroll-area][data-part=viewport]").evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(frame.getByRole("option", { name: "Account paused", exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Toggle account", exact: true }).click();
  await expect(first).toBeVisible();
});
