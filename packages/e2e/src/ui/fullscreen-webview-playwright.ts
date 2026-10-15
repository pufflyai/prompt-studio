import { expect, type Page } from "@playwright/test";

export const exerciseFullscreenWebview = async (page: Page) => {
  const webview = page.frameLocator('iframe[title="Windowing webview"]');
  const draft = webview.getByRole("textbox", { name: "Webview draft" });
  const mount = await webview.getByLabel("Webview mount").textContent();
  await draft.fill("Keep this draft across fullscreen presentation");
  await draft.press("Escape");
  await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(draft).toHaveValue("Keep this draft across fullscreen presentation");
  await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
  await page.getByRole("button", { name: "Expand page" }).click();
  await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
};

export const exerciseFullscreenEdgeDrop = async (page: Page) => {
  await page.getByRole("button", { name: "Expand page" }).click();
  const files = page.locator('[data-workbench-panel-header="main"]').getByRole("tab", { name: /^Files/ });
  const instance = await files.locator("..").getAttribute("data-workbench-tab");
  let previous = "";
  await expect
    .poll(async () => {
      const current = JSON.stringify(await files.boundingBox());
      const stable = current === previous;
      previous = current;
      return stable;
    })
    .toBe(true);
  const source = (await files.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2, { steps: 3 });
  const target = page.locator('[data-workbench-edge-target="secondary"]');
  await expect(target).toBeVisible();
  const edge = (await target.boundingBox())!;
  await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2, { steps: 12 });
  await expect(target).toHaveAttribute("data-drop-active", "true");
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Exit fullscreen" })).toHaveCount(0);
  await expect(
    page.locator(`[data-workbench-panel="secondary"] [data-workbench-tab="${instance}"]`).getByRole("tab"),
  ).toBeVisible();
};
