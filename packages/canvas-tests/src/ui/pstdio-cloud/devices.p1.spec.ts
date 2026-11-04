import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a person can reach start/stop and recover an inline provider failure.
test("cloud device controls start, stop and recover without losing their controls", async ({ page }) => {
  const manifest = await (await page.request.get("/manifest.json")).json();
  const canvas = manifest.canvases.find((entry: { title: string }) => entry.title === "Cloud/Devices");
  expect(canvas).toBeDefined();
  const preview = await openCanvasPreview(page, `${canvas.id}#StartStopAndRecover`);
  await preview.getByLabel("Provider token", { exact: true }).fill("fixture-only-token");
  await preview
    .getByLabel("Released runtime image digest", { exact: true })
    .fill(`ghcr.io/pufflyai/prompt-studio/device@sha256:${"a".repeat(64)}`);
  await preview.getByRole("button", { name: "Save provider", exact: true }).click();
  await preview.getByRole("button", { name: "Start cloud device", exact: true }).click();
  const start = preview.getByRole("button", { name: "Start", exact: true });
  const stop = preview.getByRole("button", { name: "Stop", exact: true });
  await expect(stop).toBeEnabled();
  await stop.click();
  await expect(preview.getByText("off · Presence unavailable", { exact: true })).toBeVisible();
  await start.click();
  await expect(
    preview.getByText("Cloud provider request failed. Refresh and try again.", { exact: true }),
  ).toBeVisible();
  await expect(start).toBeEnabled();
  await preview.getByRole("button", { name: "Refresh", exact: true }).first().click();
  await start.click();
  await expect(stop).toBeEnabled();
  await expect(preview.getByText("Device action failed", { exact: true })).toHaveCount(0);
});
