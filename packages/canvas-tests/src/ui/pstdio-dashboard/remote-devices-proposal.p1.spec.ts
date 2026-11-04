import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "packages/pstdio-dashboard/proposals/PS-827/remote-devices.canvas.tsx";

// Critical: the proposed primary submit/interrupt flow must enter running state and queue follow-ups.
test("remote device proposal starts and restarts a session before queuing follow-ups", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#NewSessionDevicePicker`);
  const input = preview.locator('[contenteditable="true"]').first();
  await input.fill("Start the checks");
  await preview.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Stop Response", exact: true })).toBeVisible();
  await input.fill("Then update the changelog");
  await preview.getByRole("button", { name: "Queue message", exact: true }).click();
  await expect(preview.getByText("Then update the changelog", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "Edit queued message: Then update the changelog", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Update", exact: true })).toBeVisible();
  await input.fill("Then update the release notes");
  await preview.getByRole("button", { name: "Update", exact: true }).click();
  await expect(
    preview.getByRole("button", { name: "Edit queued message: Then update the release notes", exact: true }),
  ).toBeVisible();
  await preview.getByRole("button", { name: "Stop Response", exact: true }).click();
  await input.fill("Resume the checks");
  await preview.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Stop Response", exact: true })).toBeVisible();
});
