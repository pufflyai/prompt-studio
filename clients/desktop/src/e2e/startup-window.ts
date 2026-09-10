import { type ElectronApplication, expect, type Page, test } from "@playwright/test";

export const expectStartupWindowVisible = async (application: ElectronApplication, lifecycle: Page) => {
  try {
    await expect
      .poll(() => application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible()))
      .toBe(true);
  } catch (error) {
    const [windows, renderer] = await Promise.all([
      application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map((window) => ({
          visible: window.isVisible(),
          minimized: window.isMinimized(),
          loading: window.webContents.isLoading(),
          childViews: window.contentView.children.length,
        })),
      ),
      lifecycle.evaluate(() => ({
        readyState: document.readyState,
        visibilityState: document.visibilityState,
        paints: performance.getEntriesByType("paint").map((entry) => entry.toJSON()),
      })),
    ]);
    await test.info().attach("startup-window", {
      body: JSON.stringify({ windows, renderer }),
      contentType: "application/json",
    });
    throw error;
  }
};
