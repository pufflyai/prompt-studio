import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: settings navigation and modal dismissal must not silently drop pending edits.
test("settings preserve edits on Stay and guard both navigation and closing", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/settings/settings-consistency.canvas.tsx#Settings",
  );
  const limit = preview.getByRole("spinbutton", { name: "Maximum concurrent sessions" });
  await expect(limit).toHaveValue("4");
  await limit.fill("8");
  await preview.getByText("Appearance", { exact: true }).click();
  await expect(preview.getByRole("dialog", { name: "Unsaved changes" })).toBeVisible();
  await preview.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(limit).toHaveValue("8");
  await preview.getByText("Appearance", { exact: true }).click();
  await preview.getByRole("button", { name: "Save and leave", exact: true }).click();
  await expect(preview.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
  await preview.getByText("Runtime", { exact: true }).click();
  await limit.fill("12");
  await preview.getByRole("button", { name: /^Close / }).click();
  await expect(preview.getByRole("dialog", { name: "Unsaved changes" })).toBeVisible();
  await preview.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(preview.getByRole("button", { name: /^Close / })).toHaveCount(0);
});

// Critical: unlimited concurrency must be an explicit, reversible draft rather than an empty number field.
test("concurrency toggle stages unlimited sessions and Reset restores the saved limit", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/settings/settings-consistency.canvas.tsx#Settings",
  );
  const toggle = preview.getByRole("checkbox", { name: "Limit concurrent sessions" });
  const limit = preview.getByRole("spinbutton", { name: "Maximum concurrent sessions" });
  await expect(toggle).toBeChecked();
  await toggle.press("Space");
  await expect(limit).toHaveCount(0);
  await preview.getByRole("button", { name: "Reset changes", exact: true }).click();
  await expect(toggle).toBeChecked();
  await expect(limit).toHaveValue("4");
  await toggle.press("Space");
  await preview.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  await toggle.press("Space");
  await expect(limit).toHaveValue("1");
  await preview.getByRole("button", { name: "Reset changes", exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await expect(limit).toHaveCount(0);
});

// Critical: immediate deletion must be confirmed and its header control must unmount when leaving the template.
test("template header deletion requires confirmation and stays scoped to its page", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/pstdio-workbench/src/react/settings/settings-consistency.canvas.tsx#Settings",
  );
  await preview.getByText("Bug fix", { exact: true }).click();
  const header = preview.locator("header").filter({ has: preview.getByRole("heading", { name: "Bug fix" }) });
  await header.getByRole("button", { name: "Delete template", exact: true }).click();
  await expect(preview.getByRole("dialog").filter({ hasText: "Deletion is permanent." })).toBeVisible();
  await preview.getByText("Close", { exact: true }).click();
  await expect(preview.getByRole("dialog").filter({ hasText: "Deletion is permanent." })).toHaveCount(0);
  await preview.getByText("Create ticket", { exact: true }).first().click();
  await expect(preview.getByRole("heading", { name: "Create ticket", exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Delete template", exact: true })).toHaveCount(0);
});
