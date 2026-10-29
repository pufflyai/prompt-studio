import { type ElectronApplication, expect, type Page, test } from "@playwright/test";

export const expectTitleBarGeometry = async (app: ElectronApplication, workbench: Page, lifecycle: Page) => {
  if (process.platform === "darwin") return;
  const expectGeometry = async () => {
    await expect
      .poll(async () => {
        // Native overlay events and renderer layout settle independently after window changes.
        const [native, zoom, embedded] = await Promise.all([
          lifecycle.evaluate(() => {
            const overlay = (
              navigator as Navigator & {
                windowControlsOverlay: { visible: boolean; getTitlebarAreaRect: () => DOMRect };
              }
            ).windowControlsOverlay;
            const rect = overlay.getTitlebarAreaRect();
            return { x: overlay.visible ? rect.x : 0, width: overlay.visible ? rect.width : innerWidth };
          }),
          app.evaluate(
            ({ webContents }, url) =>
              webContents
                .getAllWebContents()
                .find((c) => c.getURL() === url)!
                .getZoomFactor(),
            workbench.url(),
          ),
          workbench.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return {
              x: Number.parseFloat(style.getPropertyValue("--pstdio-title-bar-area-x")),
              width: Number.parseFloat(style.getPropertyValue("--pstdio-title-bar-area-width")),
            };
          }),
        ]);
        return { x: embedded.x - native.x / zoom, width: embedded.width - native.width / zoom };
      })
      .toEqual({ x: 0, width: 0 });
  };
  await test.step("shares the native title-bar safe area with the embedded workbench", async () => {
    await expectGeometry();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1000, 700));
    await expect.poll(() => workbench.evaluate(() => innerWidth)).toBe(1000);
    await expectGeometry();
    await workbench.reload();
    await expectGeometry();
    await app.evaluate(
      ({ webContents }, url) =>
        webContents
          .getAllWebContents()
          .find((c) => c.getURL() === url)!
          .setZoomFactor(1.25),
      workbench.url(),
    );
    await expect.poll(() => workbench.evaluate(() => innerWidth)).toBe(800);
    await expectGeometry();
    await app.evaluate(
      ({ webContents }, url) =>
        webContents
          .getAllWebContents()
          .find((c) => c.getURL() === url)!
          .setZoomFactor(1),
      workbench.url(),
    );
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1200, 800));
    await expect.poll(() => workbench.evaluate(() => innerWidth)).toBe(1200);
    await expectGeometry();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(true));
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()))
      .toBe(true);
    await expectGeometry();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(false));
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()))
      .toBe(false);
    await expectGeometry();
  });
};
