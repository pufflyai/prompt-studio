import { expect, type Page, test } from "@playwright/test";
import { movePanelTab } from "../helpers/move-panel-tab";
import { exerciseTabAndHeaderTouchMenus } from "./workbench-windowing-interactions";

const capture = async (page: Page, name: string) => {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map((animation) => animation.finished.catch(() => {})));
  });
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
};

const openInspector = async (page: Page, title: string) => {
  await page.getByRole("button", { name: / panels$/ }).click();
  const item = page.getByRole("menuitemcheckbox", { name: title, exact: true });
  if ((await item.getAttribute("aria-checked")) === "true") await page.keyboard.press("Escape");
  else await item.click();
};

export const exerciseIntegratedWindowing = async (page: Page) => {
  const controls = page.getByRole("group", { name: "Integrated scenario controls" });
  const main = page.locator('[data-workbench-panel-header="main"]');
  await capture(page, "Restored workspace after integrated journey");
  await controls.getByRole("button", { name: "Boombox", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await capture(page, "Boombox mode");
  await controls.getByRole("button", { name: "Kiln", exact: true }).click();
  await openInspector(page, "Scene and properties");
  const cube = page.getByRole("spinbutton", { name: "Cube position X", exact: true });
  await expect(cube).toBeVisible();
  await capture(page, "Kiln object Inspector");
  await controls.getByRole("button", { name: "Long note", exact: true }).click();
  const longTab = main.getByRole("tab", { name: /Release planning notes/ });
  await expect(longTab).toBeVisible();
  await longTab.focus();
  await page.keyboard.press("Shift+F10");
  const context = page.getByRole("menu");
  await expect(context).toBeVisible();
  await expect(context.getByRole("menuitem")).toHaveCount(2);
  await capture(page, "Long tab keyboard context menu");
  await page.keyboard.press("Escape");
  await expect(longTab).toBeFocused();
  await exerciseTabAndHeaderTouchMenus(page);

  await controls.getByRole("button", { name: "Ticket A", exact: true }).click();
  await openInspector(page, "Inspector");
  const ticketBinding = page.locator('[aria-label="Inspector binding"]:not([inert] *)').filter({ visible: true });
  await expect(ticketBinding).toBeVisible();
  await expect(ticketBinding).toHaveText("Ticket A");
  await capture(page, "Bound ticket Inspector");

  await controls.getByRole("button", { name: "Webview", exact: true }).click();
  const hideTools = page.getByRole("button", { name: "Hide Bottom panel", exact: true });
  if (await hideTools.isVisible()) await hideTools.click();
  const frame = page.frameLocator('iframe[title="Windowing webview"]');
  const draft = frame.getByRole("textbox", { name: "Webview draft" });
  await draft.fill("Keep this opaque iframe draft through a page-local pointer move");
  const mount = await frame.getByLabel("Webview mount").textContent();
  await page.getByRole("button", { name: "Webview panels", exact: true }).click();
  const bottomToggle = page.getByRole("menuitemcheckbox", { name: "Bottom panel", exact: true });
  await bottomToggle.click();
  const bottom = page.locator('[data-workbench-panel="bottom"]');
  await expect(bottom).toBeVisible();
  await movePanelTab(page, main.getByRole("tab", { name: "Webview", exact: true }), bottom);
  await expect(bottom.getByRole("tab", { name: "Webview", exact: true })).toBeVisible();
  await expect(draft).toHaveValue("Keep this opaque iframe draft through a page-local pointer move");
  await expect(frame.getByLabel("Webview mount")).toHaveText(mount!);
  await capture(page, "Webview retained after pointer drag");

  const resize = page.getByRole("separator", { name: "Resize page bottom", exact: true });
  await resize.focus();
  const before = await resize.getAttribute("aria-valuenow");
  await page.keyboard.press("ArrowDown");
  await expect(resize).not.toHaveAttribute("aria-valuenow", before!);
  await expect(resize).toBeFocused();
  const keyboardSize = await resize.getAttribute("aria-valuenow");
  await resize.click({ trial: true });
  const handle = (await resize.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 12, { steps: 5 });
  await page.mouse.up();
  await expect(resize).not.toHaveAttribute("aria-valuenow", keyboardSize!);
  await expect(draft).toHaveValue("Keep this opaque iframe draft through a page-local pointer move");
  await capture(page, "Pointer and keyboard resize");
  const savedSize = await resize.getAttribute("aria-valuenow");
  await resize.click({ trial: true });
  const closingHandle = (await resize.boundingBox())!;
  await page.mouse.move(closingHandle.x + closingHandle.width / 2, closingHandle.y + closingHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(closingHandle.x + closingHandle.width / 2, closingHandle.y + Number(savedSize) + 100, {
    steps: 5,
  });
  await expect(resize.locator("..")).toHaveAttribute("data-closing", "true");
  await capture(page, "Page bottom closing preview");
  await page.mouse.up();
  await expect(bottom).toBeHidden();
  const note = page.locator('[data-workbench-panel="side"]').getByRole("tab", { name: "Note A", exact: true });
  const noteBox = (await note.boundingBox())!;
  await page.mouse.move(noteBox.x + noteBox.width / 2, noteBox.y + noteBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(noteBox.x + noteBox.width / 2 + 12, noteBox.y + noteBox.height / 2, { steps: 3 });
  const closedEdge = page.locator('[data-workbench-edge-target="bottom"]');
  await expect(closedEdge).toBeVisible();
  const edgeBox = (await closedEdge.boundingBox())!;
  await page.mouse.move(edgeBox.x + edgeBox.width / 2, edgeBox.y + edgeBox.height / 2, { steps: 6 });
  await expect(closedEdge).toHaveAttribute("data-drop-active", "true");
  await capture(page, "Closed page edge drop preview");
  await page.mouse.up();
  await expect(bottom.getByRole("tab", { name: "Note A", exact: true })).toBeVisible();
  await bottom.getByRole("tab", { name: "Webview", exact: true }).click();
  await expect(resize).toHaveAttribute("aria-valuenow", savedSize!);
  await expect(draft).toHaveValue("Keep this opaque iframe draft through a page-local pointer move");
  await expect(frame.getByLabel("Webview mount")).toHaveText(mount!);
  await page.getByRole("button", { name: "Expand page", exact: true }).click();
  await draft.focus();
  await page.getByRole("button", { name: "Exit fullscreen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand page", exact: true })).toBeFocused();
  await expect(frame.getByLabel("Webview mount")).toHaveText(mount!);
  await controls.getByRole("button", { name: "Reload fixture", exact: true }).click();
  await expect(bottom.getByRole("tab", { name: "Webview", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand page", exact: true })).toBeVisible();
  await capture(page, "Page-local owner restored after reload");
};
