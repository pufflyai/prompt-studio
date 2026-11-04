import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: settings navigation and modal dismissal must not silently drop pending edits.
test("settings preserve edits on Stay and guard both navigation and closing", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/settings/settings-consistency.canvas.tsx#Settings",
  );
  const limit = preview.getByRole("spinbutton", { name: "Maximum concurrent sessions" });
  await expect(limit).toHaveValue("4");
  await limit.fill("8");
  await preview.getByText("Appearance", { exact: true }).click();
  await expect(preview.getByRole("dialog", { name: "Unsaved changes" })).toBeVisible();
  await preview.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(limit).toHaveValue("8");
  await preview.getByText("Appearance", { exact: true }).click();
  await preview.getByRole("button", { name: "Save and leave", exact: true }).click();
  await expect(preview.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
  await preview.getByText("Runtime", { exact: true }).click();
  await limit.fill("12");
  await preview.getByRole("button", { name: /^Close / }).click();
  await expect(preview.getByRole("dialog", { name: "Unsaved changes" })).toBeVisible();
  await preview.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(preview.getByRole("button", { name: /^Close / })).toHaveCount(0);
});
