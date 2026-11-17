import { expect, test } from "@playwright/test";

const frame =
  "packages/pstdio-dashboard/src/modules/projects/components/desktop-project-tabs.canvas.tsx#WindowControlsOverlay";

test("Main fullscreen keeps its exit button clear of the native window controls", async ({ page }) => {
  await page.goto(`/?frame=${encodeURIComponent(frame)}`);
  const canvas = page.frameLocator("[data-verification-host]").locator(`[data-canvas-item="${frame}"]`);
  await canvas.getByRole("button", { name: /^Select / }).click();
  const preview = canvas.frameLocator("iframe");
  const enter = preview.getByRole("button", { name: "Enter Main fullscreen", exact: true });
  const projectTabs = preview.getByRole("tablist", { name: "Project tabs", exact: true });
  await enter.click();

  const exit = preview.getByRole("button", { name: "Exit Main fullscreen", exact: true });
  await expect(exit).toBeVisible();
  await expect
    .poll(() => exit.evaluate((button) => button.getBoundingClientRect().right <= innerWidth - 140))
    .toBe(true);
  await expect(preview.getByRole("button", { name: "Open / create project", exact: true })).toBeHidden();
  await expect(projectTabs).toBeHidden();
  await expect(preview.getByRole("list", { name: "Other editors", exact: true })).toBeVisible();
  await exit.click();
  await expect(enter).toBeFocused();
  await expect(projectTabs).toBeVisible();
});
