import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: dismissing an in-flight setup error must leave the next failure and its recovery action visible.
test("a setup retry failure reappears after dismissing the previous error", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-dashboard/src/shared/projects/project-setup-status.canvas.tsx#RetryFailure",
  );
  const alert = preview.getByRole("alert");
  await expect(alert).toContainText("The folder could not be prepared.");
  await alert.getByRole("button", { name: "Retry setup" }).click();
  await alert.getByRole("button", { name: "Dismiss" }).click();
  await expect(alert).toHaveCount(0);
  await preview.getByRole("button", { name: "Finish setup attempt" }).click();
  await expect(alert).toContainText("The extension download failed.");
  await expect(alert.getByRole("button", { name: "Retry setup" })).toBeEnabled();
  await alert.getByRole("button", { name: "Retry setup" }).click();
  await alert.getByRole("button", { name: "Dismiss" }).click();
  await expect(alert).toHaveCount(0);
  await preview.getByRole("button", { name: "Finish setup attempt" }).click();
  await expect(alert).toContainText("The extension download failed.");
});
