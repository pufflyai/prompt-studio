import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: a waiting source's recovery control and essential phase must remain reachable.
test("Cloud details exposes the waiting source and retries it without hiding file activity", async ({ page }) => {
  const frame = await openCanvasPreview(page, "extensions/pstdio-cloud/src/sync-activity.canvas.tsx#DownloadDetails");
  await expect(frame.getByText("No files are downloading.", { exact: false })).toBeVisible();
  await frame.getByRole("button", { name: "Project data", exact: true }).click();
  await expect(frame.getByText("Merging records", { exact: true })).toBeVisible();
  await expect(frame.getByText("2 internal sync documents ready · Total not known yet", { exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Retry Sessions", exact: true }).click();
  await frame.getByRole("button", { name: "Files", exact: true }).click();
  await expect(frame.getByText("draft-draft.json", { exact: true })).toBeVisible();
  await expect(frame.getByText("32 of 348 encrypted bytes", { exact: true })).toBeVisible();
  await expect(frame.getByText("Sessions · Cloud → This device", { exact: true })).toBeVisible();
});
