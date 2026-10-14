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
  const header = (await page.locator('[data-workbench-panel-header="main"]').boundingBox())!;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: header.x + header.width / 2, y: header.y + header.height / 2 }],
  });
  await expect(page.getByRole("menuitem", { name: "Hide header", exact: true })).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.keyboard.press("Escape");
  await client.detach();
};

export const exerciseRetainedWebview = async (page: Page, storyId: string) => {
  const webview = page.frameLocator('iframe[title="Windowing webview"]');
  const draft = webview.getByRole("textbox", { name: "Webview draft" });
  const mount = await webview.getByLabel("Webview mount").textContent();
  await draft.fill("Retained iframe draft");
  await expect(draft).toHaveValue("Retained iframe draft");
  await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
  if (storyId.endsWith("--page-surface-webview")) {
    const bottom = page.locator('[data-workbench-panel="bottom"]');
    const tab = page.getByRole("tab", { name: "Webview", exact: true });
    const source = (await tab.boundingBox())!;
    const target = (await bottom.boundingBox())!;
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(bottom.getByRole("tab", { name: "Webview", exact: true })).toBeVisible();
    await expect(draft).toHaveValue("Retained iframe draft");
    await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
    await expect(page.getByLabel("Inspector binding")).toHaveText("Workspace 1");
  }
};

export const readWindowingStoryOutcome = (page: Page) =>
  page.evaluate(() => {
    const channel = (
      window as unknown as { __STORYBOOK_ADDONS_CHANNEL__?: { last(event: string): unknown[] | undefined } }
    ).__STORYBOOK_ADDONS_CHANNEL__;
    return {
      result: channel?.last("storyFinished")?.[0],
      errors: [
        "storyErrored",
        "storyThrewException",
        "playFunctionThrewException",
        "unhandledErrorsWhilePlaying",
      ].flatMap((event) => channel?.last(event) ?? []),
    };
  });

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
