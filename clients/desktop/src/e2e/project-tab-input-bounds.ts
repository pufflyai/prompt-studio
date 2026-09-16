import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { PROJECT_TAB_BOUNDS_CHANNEL } from "../windows/project-tab-input";

export const expectProjectTabInputBounds = async (app: ElectronApplication, page: Page) => {
  if (process.platform !== "darwin") return;
  await test.step("limits native mouse filtering to visible project tab triggers", async () => {
    const source = { url: page.url(), channel: PROJECT_TAB_BOUNDS_CHANNEL };
    await app.evaluate(({ webContents }, { url, channel }) => {
      const contents = webContents.getAllWebContents().find((candidate) => candidate.getURL() === url)!;
      contents.ipc.on(channel, (_event, bounds) => Reflect.set(contents, "testTabBounds", bounds));
    }, source);
    const readBounds = () =>
      app.evaluate(
        ({ webContents }, url) =>
          Reflect.get(
            webContents.getAllWebContents().find((candidate) => candidate.getURL() === url)!,
            "testTabBounds",
          ),
        source.url,
      );
    await page.evaluate(() => {
      const header = document.createElement("div");
      header.setAttribute("data-window-title-bar", "");
      header.innerHTML =
        '<div role="tablist" style="display:flex;width:160px;overflow:auto"><button role="tab" style="flex:0 0 100px">First</button><button aria-label="Close first">×</button><button role="tab" style="flex:0 0 100px">Second</button></div>';
      document.body.append(header);
    });
    const expectedBounds = async (scale: number) =>
      page.getByRole("tab").evaluateAll(
        (tabs, scale) =>
          tabs.flatMap((tab) => {
            const rect = tab.getBoundingClientRect();
            const clip = tab.parentElement!.getBoundingClientRect();
            const left = Math.max(rect.left, clip.left);
            const right = Math.min(rect.right, clip.right);
            return right > left
              ? [{ x: left * scale, y: rect.y * scale, width: (right - left) * scale, height: rect.height * scale }]
              : [];
          }),
        scale,
      );
    await expect.poll(readBounds).toEqual(await expectedBounds(1));
    await page.getByRole("tablist").evaluate((list) => {
      list.scrollLeft = list.scrollWidth;
    });
    await expect.poll(readBounds).toEqual(await expectedBounds(1));
    await page.getByRole("tablist").evaluate((list) => {
      list.style.width = "120px";
    });
    await expect.poll(readBounds).toEqual(await expectedBounds(1));
    await app.evaluate(({ webContents }, url) => {
      webContents
        .getAllWebContents()
        .find((candidate) => candidate.getURL() === url)!
        .setZoomFactor(1.5);
    }, source.url);
    await expect.poll(readBounds).toEqual(await expectedBounds(1.5));
    await page.evaluate(() => {
      const overlay = document.createElement("div");
      overlay.id = "input-bounds-overlay";
      overlay.style.cssText = "position:fixed;inset:0;z-index:10";
      document.body.append(overlay);
    });
    await expect.poll(readBounds).toEqual([]);
    await page.evaluate(() => document.getElementById("input-bounds-overlay")!.remove());
    await expect.poll(readBounds).toEqual(await expectedBounds(1.5));
    await page.evaluate(() => document.querySelector("[data-window-title-bar]")!.remove());
    await expect.poll(readBounds).toEqual([]);
    await app.evaluate(({ webContents }, url) => {
      webContents
        .getAllWebContents()
        .find((candidate) => candidate.getURL() === url)!
        .setZoomFactor(1);
    }, source.url);
  });
};
