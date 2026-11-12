import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "packages/pstdio-workbench/src/react/renderers/tree/tree-connection-loss.canvas.tsx";

// Critical: an initial dropped page response must recover without blocking navigation on a Retry banner.
test("an initial connection failure stays quiet and recovers automatically", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#InitialConnectionFailure`);
  await expect(preview.getByText("Could not connect to the backend.", { exact: true })).toHaveCount(0);
  await expect(preview.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Restore response", exact: true }).click();
  await expect(preview.getByRole("option", { name: "Notes", exact: true })).toBeVisible();
});

// Critical: a background connection failure must preserve loaded navigation and keep real view errors actionable.
test("loaded navigation survives dropped responses and still reports view errors", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#RetainNavigation`);
  const notes = preview.getByRole("option", { name: "Notes", exact: true });
  await expect(notes).toBeVisible();
  await preview.getByRole("button", { name: "Drop response", exact: true }).click();
  await expect(notes).toBeVisible();
  await expect(preview.getByText("Could not connect to the backend.", { exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Fail view", exact: true }).click();
  await expect(preview.getByText("This view has an invalid query.", { exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Restore response", exact: true }).click();
  await preview.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(notes).toBeVisible();
  await expect(preview.getByText("This view has an invalid query.", { exact: true })).toHaveCount(0);
});
