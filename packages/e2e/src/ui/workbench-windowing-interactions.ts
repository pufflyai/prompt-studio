import { expect, type Page } from "@playwright/test";
import { movePanelTab } from "../helpers/move-panel-tab";

export const exerciseTabAndHeaderTouchMenus = async (page: Page) => {
  await page.getByRole("button", { name: "Note A", exact: true }).first().click();
  const tab = page.getByRole("tab", { name: "Note A", exact: true });
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  const box = (await tab.boundingBox())!;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  const menu = page.getByRole("menu", { name: "Note A context menu", exact: true });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await page.getByLabel("main header", { exact: true }).focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Hide header", exact: true }).click();
  const edge = page.getByLabel("main header edge", { exact: true });
  const header = (await edge.boundingBox())!;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: header.x + header.width / 2, y: header.y + header.height / 2 }],
  });
  const show = page.getByRole("menuitem", { name: "Show header", exact: true });
  await expect(show).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await show.click();
  await expect(page.locator('[data-workbench-panel-header="main"]')).toBeVisible();
  await client.detach();
};

const exerciseInspectorDrop = async (page: Page) => {
  const tab = page.locator('[data-workbench-panel-header="main"]').getByRole("tab");
  const inspector = page.locator('[data-workbench-panel-menu="main-right"]');
  await movePanelTab(page, tab, inspector);
  await expect(tab).toBeVisible();
  await expect(page.locator("[data-workbench-tab-drop][data-drop-active]")).toHaveCount(0);
};

export const windowingInteractions: Record<string, (page: Page) => Promise<void>> = {
  "pstdio-workbench-guides-windowing--ticket-panel-menu": exerciseInspectorDrop,
  "pstdio-workbench-guides-tab-actions--pin-and-close": exerciseTabAndHeaderTouchMenus,
};
