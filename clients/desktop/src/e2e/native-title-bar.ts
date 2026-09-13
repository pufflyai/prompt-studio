import { type ElectronApplication, expect, type Page, test } from "@playwright/test";

export const nativeTitleBarFixture = `<header data-window-title-bar style="height:44px;background:rgb(249,251,250);color:rgb(20,24,22);-webkit-app-region:drag">
  <div id="title-bar-content" style="height:100%;margin-left:env(titlebar-area-x,var(--pstdio-titlebar-area-x,0px));width:env(titlebar-area-width,var(--pstdio-titlebar-area-width,100%))">Project tabs</div>
</header>`;

export const expectNativeTitleBar = async (app: ElectronApplication, page: Page) => {
  if (process.platform === "darwin") return;
  await test.step("updates native controls when the title bar remounts", async () => {
    const overlayHeight = () =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
          "navigator.windowControlsOverlay.getTitlebarAreaRect().height",
        ),
      );
    const height = await overlayHeight();
    await page.locator("[data-window-title-bar]").evaluate((bar) => {
      const replacement = bar.cloneNode(true) as HTMLElement;
      replacement.style.height = "64px";
      bar.replaceWith(replacement);
    });
    await expect.poll(overlayHeight).toBeGreaterThan(height);
    await page.locator("[data-window-title-bar]").evaluate((bar) => {
      (bar as HTMLElement).style.height = "44px";
    });
    await expect.poll(overlayHeight).toBe(height);
  });
  await test.step("reserves native controls in the child view after resize and zoom", async () => {
    for (const [width, zoom] of [
      [1200, 1],
      [900, 1.25],
      [1200, 1],
    ]) {
      await app.evaluate(
        ({ BrowserWindow }, { width, zoom }) => {
          const window = BrowserWindow.getAllWindows()[0];
          window.setContentSize(width, 800);
          const view = window.contentView.children[0] as Electron.WebContentsView;
          view.webContents.setZoomFactor(zoom);
        },
        { width, zoom },
      );
      await expect
        .poll(async () => {
          const area = await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
              "navigator.windowControlsOverlay.getTitlebarAreaRect().toJSON()",
            ),
          );
          const content = await page.locator("#title-bar-content").boundingBox();
          const viewport = await page.evaluate(() => innerWidth);
          return content !== null && content.width < viewport && Math.abs(content.width - area.width / zoom) < 1;
        })
        .toBe(true);
    }
  });
  await test.step("releases the safe area while native controls are hidden in full screen", async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(true));
    await expect
      .poll(async () => {
        const content = await page.locator("#title-bar-content").boundingBox();
        return content?.width === (await page.evaluate(() => innerWidth));
      })
      .toBe(true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(false));
    await expect
      .poll(async () => {
        const content = await page.locator("#title-bar-content").boundingBox();
        return content !== null && content.width < (await page.evaluate(() => innerWidth));
      })
      .toBe(true);
  });
};
