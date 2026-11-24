import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a cancelled load must not strand the primary view when a closed preview returns.
test("leaving during preview loading starts a fresh working preview on return", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/workbench/preview-load-return.canvas.tsx#LoadingPreviewReturn",
  );
  const guest = preview.frameLocator('iframe[title="Loading preview"]');
  await preview.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(guest.getByText("Loading preview", { exact: true })).toBeVisible();
  await expect(preview.getByLabel("Pending loads")).toHaveText("1");
  await preview.getByRole("button", { name: "Home", exact: true }).click();
  await expect(preview.getByText("Home content", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(preview.getByLabel("Pending loads")).toHaveText("1");
  await preview.getByRole("button", { name: "Finish loading", exact: true }).click();
  await expect(guest.getByText("Preview ready", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Pin canvas", exact: true }).click();
  await guest.getByRole("textbox", { name: "Preview draft" }).fill("Keep this pinned canvas");
  await preview.getByRole("button", { name: "Home", exact: true }).click();
  await expect(preview.getByText("Home content", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(guest.getByRole("textbox", { name: "Preview draft" })).toHaveValue("Keep this pinned canvas");
  await expect(preview.getByLabel("Pending loads")).toHaveText("0");
});
