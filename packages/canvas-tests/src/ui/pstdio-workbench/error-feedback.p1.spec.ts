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
  const dismiss = alert.getByRole("button", { name: "Dismiss" });
  const rightInset = await dismiss.evaluate((button) => {
    const alert = button.closest('[role="alert"]')!;
    return {
      actual: alert.getBoundingClientRect().right - button.getBoundingClientRect().right,
      expected: Number.parseFloat(getComputedStyle(alert).paddingInlineEnd),
    };
  });
  expect(rightInset.actual).toBeCloseTo(rightInset.expected, 0);
  await dismiss.press("Enter");
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
  const before = await action.boundingBox();
  await action.click();
  const status = preview.locator('[data-workbench-region="status"]');
  const widget = status.locator('[data-status-bar-item="workbench.system-activity"]');
  await widget.getByRole("button", { name: "System notices: Update ready" }).press("Enter");
  const details = preview.getByRole("region", { name: "System notice list" });
  await expect(details.getByText("Update ready", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "Dismiss Update ready" }).press("Enter");
  await expect(status).toBeHidden();
  expect(await action.boundingBox()).toEqual(before);
});

test("System activity stays pinned when other status widgets reorder", async ({ page }) => {
  const preview = await openCanvasPreview(page, `${canvas}#SystemAndActionErrors`);
  const status = preview.locator('[data-workbench-region="status"]');
  const activity = status.getByRole("group", { name: "System activity" });
  const idleActivity = activity.getByRole("button", { name: "System activity", exact: true });
  await expect(idleActivity).toBeVisible();
  await idleActivity.press("Enter");
  const details = preview.getByRole("region", { name: "System notice list" });
  await expect(details).toBeVisible();
  await expect(details.getByRole("alert")).toHaveCount(0);
  await idleActivity.press("Enter");
  await expect(details).toBeHidden();

  await preview.getByRole("button", { name: "Report system information" }).click();
  await activity.getByRole("button", { name: "System notices: Update ready" }).press("Enter");
  await details.getByRole("button", { name: "Dismiss Update ready" }).press("Enter");
  await expect(idleActivity).toBeVisible();
  await expect(details).toBeVisible();
  await idleActivity.press("Enter");

  const first = status.getByRole("group", { name: "First tool" });
  const second = status.getByRole("group", { name: "Second tool" });
  await expect(activity).toBeVisible();
  await expect(activity).not.toHaveAttribute("data-sortable", "true");
  await second.press("Alt+ArrowLeft");
  await expect.poll(async () => (await second.boundingBox())!.x).toBeLessThan((await first.boundingBox())!.x);
  await second.press("Alt+ArrowLeft");
  expect((await activity.boundingBox())!.x).toBeLessThan((await second.boundingBox())!.x);
});
