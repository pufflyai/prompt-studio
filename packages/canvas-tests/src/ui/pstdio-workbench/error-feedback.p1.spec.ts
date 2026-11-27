import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

const canvas = "packages/pstdio-workbench/src/react/notifications/error-feedback.canvas.tsx";

test("dismissing an action error leaves its controls in place", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#SystemAndActionErrors`);
  const action = preview.getByRole("button", { name: "Save file" });
  await expect(action).toBeVisible();
  const before = await action.boundingBox();
  await action.click();
  const alert = preview.getByRole("alert");
  await expect(alert).toBeVisible();
  expect(await action.boundingBox()).toEqual(before);
  await alert.getByRole("button", { name: "Dismiss" }).press("Enter");
  await expect(alert).toHaveCount(0);
  expect(await action.boundingBox()).toEqual(before);
});

// Critical: reset failures must stay visible without losing editable values or blocking recovery.
test("reset-only settings keep values and the reset action available after an error", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/renderers/controls/controls-view.canvas.tsx#ResetFailure",
  );
  const reset = preview.getByRole("button", { name: "Reset to defaults" });
  const field = preview.getByText("Device name", { exact: true });
  await expect(reset).toBeVisible();
  await expect(field).toBeVisible();
  const input = preview.getByRole("textbox");
  await input.fill("Keep this value");
  await input.blur();
  const resetPosition = await reset.boundingBox();
  const fieldPosition = await field.boundingBox();

  await reset.click();
  const alert = preview.getByRole("alert");
  await expect(alert).toHaveText("Could not reset device settings. Try again.");
  expect(await field.boundingBox()).toEqual(fieldPosition);
  expect(await reset.boundingBox()).toEqual(resetPosition);
  await alert.getByRole("button", { name: "Dismiss" }).press("Enter");
  await expect(alert).toHaveCount(0);
  await expect(input).toHaveValue("Keep this value");
  await reset.click();
  await expect(alert).toBeVisible();
  await alert.getByRole("button", { name: "Dismiss" }).press("Enter");
  await expect(input).toHaveValue("Keep this value");
  await reset.click();
  await expect(input).toHaveValue("Desk");
  await expect(alert).toHaveCount(0);
});

test("system information can be opened and dismissed in the status bar", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#HiddenStatusBar`);
  const action = preview.getByRole("button", { name: "Report system information" });
  await expect(action).toBeVisible();
  // Measure within the preview: fitting the Canvas camera can change its outer browser scale.
  const rect = () =>
    action.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
  const before = await rect();
  await action.click();
  const status = preview.locator('[data-workbench-region="status"]');
  const widget = status.locator('[data-status-bar-item="workbench.system-activity"]');
  await widget.press("Enter");
  const details = preview.getByRole("region", { name: "System notice list" });
  await expect(details.getByText("Update ready", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Dismiss Update ready" }).press("Enter");
  await expect(status).toBeHidden();
  expect(await rect()).toEqual(before);
});

// Critical: notices must remain keyboard accessible while sharing ordinary widget layout controls.
test("system notices hide when empty and retain normal widget alignment", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#SystemAndActionErrors`);
  const status = preview.locator('[data-workbench-region="status"]');
  const activity = status.getByRole("button", { name: "System activity", exact: true });
  await expect(activity).toBeHidden();
  await preview.getByRole("button", { name: "Report system information" }).click();
  await expect(activity).toBeVisible();
  await expect(status.getByRole("status").filter({ hasText: "System notices: Update ready" })).toHaveText(
    "System notices: Update ready",
  );
  await expect(activity).toHaveAttribute("data-sortable", "true");
  const second = status.getByRole("group", { name: "Second tool", exact: true });
  await activity.press("Alt+ArrowLeft");
  await expect.poll(async () => (await activity.boundingBox())!.x).toBeLessThan((await second.boundingBox())!.x);
  await activity.press("Alt+Shift+ArrowRight");
  await expect(activity).toHaveAttribute("data-status-bar-slot", "center");
  await activity.press("Enter");
  const details = preview.getByRole("region", { name: "System notice list" });
  await expect(details.getByText("Update ready", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Dismiss Update ready" }).press("Enter");
  await expect(activity).toBeHidden();
  await expect(details).toBeHidden();
  await preview.getByRole("button", { name: "Report system information" }).click();
  await expect(activity).toHaveAttribute("data-status-bar-slot", "center");
  await activity.press("Alt+Shift+ArrowRight");
  await expect(activity).toHaveAttribute("data-status-bar-slot", "trailing");
  await activity.press("Enter");
  await preview.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(activity).toBeHidden();
});

test("clear all empties the widget and dismissed upgrades remain recoverable", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#HiddenStatusBar`);
  await preview.getByRole("button", { name: "Report system information" }).click();
  await preview.getByRole("button", { name: "Report failed upgrade" }).click();
  await preview.getByRole("button", { name: "Start operation" }).click();
  const activity = preview.getByRole("button", { name: "System activity", exact: true });
  await activity.press("Enter");
  await expect(preview.getByRole("alert")).toContainText("Upgrading");
  await expect(preview.getByRole("button", { name: "Dismiss Publish report" })).toBeVisible();
  const clearAll = preview.getByRole("button", { name: "Clear all", exact: true });
  await clearAll.press("Enter");
  await expect(activity).toHaveCount(0);
  await preview.getByRole("button", { name: "Finish operation" }).press("Alt+Shift+K");
  const palette = preview.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("textbox").fill(">Recover changes");
  await palette.getByRole("option", { name: "Recover changes" }).click();
  const recovery = preview.getByRole("dialog", { name: "Recover changes" });
  await expect(recovery.getByRole("button", { name: "Copy draft" })).toBeVisible();
});

test("a running operation can be dismissed on its own", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#SystemAndActionErrors`);
  await preview.getByRole("button", { name: "Start operation" }).click();
  const activity = preview.getByRole("button", { name: "System activity", exact: true });
  await activity.press("Enter");
  await preview.getByRole("button", { name: "Dismiss Publish report" }).press("Enter");
  await expect(activity).toHaveCount(0);
  await preview.getByRole("button", { name: "Finish operation" }).click();
  await expect(activity).toHaveCount(0);
});
