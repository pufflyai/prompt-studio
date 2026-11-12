import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "packages/pstdio-workbench/src/react/renderers/tree/tree-connection-loss.canvas.tsx";

// Critical: an initial dropped page response must recover without blocking navigation on a Retry banner.
test("an initial connection failure stays quiet and recovers automatically", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/renderer-connection-recovery.canvas.tsx#InitialConnectionFailure",
  );
  await expect(preview.getByText(/^Read attempts [1-9]/)).toBeVisible();
  await expect(preview.getByText("Could not connect to the backend.", { exact: true })).toHaveCount(0);
  await expect(preview.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Restore response", exact: true }).click();
  await expect(preview.getByText("Loaded content", { exact: true })).toBeVisible();
});

// Critical: a background connection failure must preserve loaded navigation and keep real view errors actionable.
test("loaded navigation survives dropped responses and still reports view errors", async ({ page }) => {
  await page.clock.install();
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
  await page.clock.runFor(1_000);
  await expect(preview.getByText("This view has an invalid query.", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(notes).toBeVisible();
  await expect(preview.getByText("This view has an invalid query.", { exact: true })).toHaveCount(0);
});

// Critical: Extensions must recover without a banner, while inactive pages must stop retrying.
test("catalog pages retry quietly only while displayed", async ({ page }) => {
  await page.clock.install();
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-dashboard/src/shared/extensions/catalog-connection-recovery.canvas.tsx#InitialConnectionFailure",
  );
  await expect(preview.getByText(/^Read attempts [1-9]/)).toBeVisible();
  await expect(preview.getByText("Loading extensions", { exact: true })).toBeVisible();
  await expect(preview.getByText("Could not connect to the backend.", { exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Hide page", exact: true }).click();
  const attempts = preview.getByText(/^Read attempts /);
  const stopped = await attempts.textContent();
  await page.clock.runFor(5_000);
  await expect(attempts).toHaveText(stopped!);
  await preview.getByRole("button", { name: "Show page", exact: true }).click();
  await page.clock.runFor(1_000);
  await expect(attempts).not.toHaveText(stopped!);
  await expect(preview.getByText("Could not connect to the backend.", { exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Restore response", exact: true }).click();
  await page.clock.runFor(1_000);
  await expect(preview.getByText("Loaded extensions", { exact: true })).toBeVisible();
});
