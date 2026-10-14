import { expect, type Page } from "@playwright/test";
export const exerciseWebview = async (page: Page, storyId: string) => {
  const webview = page.frameLocator('iframe[title="Windowing webview"]');
  const draft = webview.getByRole("textbox", { name: "Webview draft" });
  const mount = await webview.getByLabel("Webview mount").textContent();
  await draft.fill("Retained iframe draft");
  await expect(draft).toHaveValue("Retained iframe draft");
  await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
  if (storyId.endsWith("--page-surface-webview")) {
    await page.getByRole("button", { name: "Session 1", exact: true }).click();
    const dragHeader = page.locator('[data-workbench-panel-drag="side"]');
    await dragHeader.click({ trial: true });
    const header = (await dragHeader.boundingBox())!;
    const frame = (await page.locator('iframe[title="Windowing webview"]').boundingBox())!;
    const x = header.x + header.width * 0.65;
    const y = header.y + header.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 8, y, { steps: 3 });
    await expect(page.locator('[data-workbench-edge-target="side"]')).toBeVisible();
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('[data-workbench-edge-target="side"]')).toHaveCount(0);
    await expect(draft).toHaveValue("Retained iframe draft");
    await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
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
