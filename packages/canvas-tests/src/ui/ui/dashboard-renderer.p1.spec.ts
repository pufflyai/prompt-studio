import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: controlled layout edits must survive live data refresh and failed saves, and Cancel must not publish them.
test("apply and cancel dashboard edits through the caller-owned definition", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/dashboard-renderer/dashboard.canvas.tsx#Dashboard",
  );
  const chooseBehavior = async (name: string) => {
    await preview.getByRole("button", { name: /^(Editable|Save failure)$/ }).click();
    await preview.getByRole("menuitemradio", { name, exact: true }).click();
  };
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  const metric = preview.locator('[data-widget-id="conversations"]');
  await metric.hover();
  await metric.getByRole("button", { name: "Configure Agent conversations", exact: true }).click();
  const settings = preview.getByRole("dialog", { name: "Widget settings", exact: true });
  await settings.getByRole("textbox", { name: "Title", exact: true }).fill("Weekly conversations");
  await settings.getByRole("button", { name: "Close widget settings", exact: true }).click();
  await preview.getByRole("button", { name: "Last 7 days", exact: true }).click();
  await preview.getByRole("menuitemradio", { name: "Last 3 days", exact: true }).click();
  await expect(metric.getByRole("heading", { name: "Weekly conversations", exact: true })).toBeVisible();
  await expect(metric.getByText("299", { exact: true })).toBeVisible();
  await chooseBehavior("Save failure");
  await preview.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(preview.getByRole("alert")).toBeVisible();
  await expect(metric.getByRole("heading", { name: "Weekly conversations", exact: true })).toBeVisible();
  await chooseBehavior("Editable");
  await preview.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Edit dashboard", exact: true })).toBeFocused();
  await preview.getByRole("button", { name: "Edit dashboard", exact: true }).click();
  await metric.hover();
  await metric.getByRole("button", { name: "Configure Weekly conversations", exact: true }).click();
  await settings.getByRole("textbox", { name: "Title", exact: true }).fill("");
  await settings.getByRole("button", { name: "Close widget settings", exact: true }).click();
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(metric.getByRole("heading", { name: "Weekly conversations", exact: true })).toBeVisible();
  await chooseBehavior("Read only");
  await expect(preview.getByRole("button", { name: "Edit dashboard", exact: true })).toHaveCount(0);
  await expect(metric.getByRole("heading", { name: "Weekly conversations", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
