import { type ElectronApplication, expect, type Page } from "@playwright/test";

export const focusWorkbench = async (electronApp: ElectronApplication, page: Page) => {
  await electronApp.evaluate(({ app, BrowserWindow }) => {
    app.focus({ steal: true });
    BrowserWindow.getAllWindows()[0].focus();
  });
  await page.bringToFront();
  // Playwright emulates document focus even when Cocoa still targets another app.
  await expect
    .poll(() =>
      electronApp.evaluate(({ BrowserWindow, webContents }) => ({
        nativeWindow: BrowserWindow.getAllWindows()[0].isFocused(),
        workbenchUrl: webContents.getFocusedWebContents()?.getURL(),
      })),
    )
    .toEqual({ nativeWindow: true, workbenchUrl: page.url() });
};
