import { expect, type Page } from "@playwright/test";

export const verifyPackagedPanelMenuTabs = async (page: Page, origin: string, projectId: string) => {
  await page.goto(`${origin}/projects/${projectId}/extensions/pstdio.workbench-fixture/cameras`);
  const header = page.locator('[data-workbench-panel-header="main"]');
  const attachedMenu = page.locator('[data-workbench-panel-menu="main-left"]');
  await expect(attachedMenu).toBeVisible();
  await expect(header).toBeHidden();
  await page.getByRole("separator", { name: "Resize Main left menu", exact: true }).dblclick();
  const tab = header.getByRole("tab", { name: "Cams", exact: true });
  await expect(tab).toBeVisible();
  await expect(header.getByRole("tab")).toHaveCount(1);
  await expect(tab.getByRole("button", { name: "Close Cams", exact: true })).toHaveCount(0);
  await header.getByRole("button", { name: "Open Main left menu", exact: true }).click();
  await expect(attachedMenu).toBeVisible();
  await expect(header).toBeHidden();
  await page.setViewportSize({ width: 500, height: 720 });
  await expect(tab).toBeVisible();
  await expect(header.getByRole("button", { name: "Open Main left menu", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
};
