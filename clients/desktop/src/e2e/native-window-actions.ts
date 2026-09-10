import { type ElectronApplication, expect, type Page, test } from "@playwright/test";

export const expectNativeWindowActions = async (electronApp: ElectronApplication, window: Page, lifecycle: Page) => {
  if (process.platform === "darwin") {
    await test.step("follows native full screen, including a renderer reload", async () => {
      await electronApp.evaluate(async ({ BrowserWindow }) => {
        const nativeWindow = BrowserWindow.getAllWindows()[0];
        const entered = new Promise<void>((resolve) => nativeWindow.once("enter-full-screen", () => resolve()));
        nativeWindow.setFullScreen(true);
        await entered;
      });
      await expect(window.locator("html")).toHaveAttribute("data-window-full-screen", "");
      await expect(lifecycle.locator("html")).toHaveAttribute("data-window-full-screen", "");
      await window.reload();
      await expect(window.locator("html")).toHaveAttribute("data-window-full-screen", "");
      await electronApp.evaluate(async ({ BrowserWindow }) => {
        const nativeWindow = BrowserWindow.getAllWindows()[0];
        const left = new Promise<void>((resolve) => nativeWindow.once("leave-full-screen", () => resolve()));
        nativeWindow.setFullScreen(false);
        await left;
      });
      await expect(window.locator("html")).not.toHaveAttribute("data-window-full-screen");
      await expect(lifecycle.locator("html")).not.toHaveAttribute("data-window-full-screen");
    });
  }
  await test.step("delivers native menu actions to the workbench", async () => {
    await window.evaluate(() => {
      const received: string[] = [];
      const stop = (globalThis as unknown as Window).promptStudioDesktop.onCommand((id) => received.push(id));
      Object.assign(globalThis, { receivedCommands: received, stopDesktopCommands: stop });
    });
    await electronApp.evaluate(({ Menu, BrowserWindow, webContents }) => {
      const settings = Menu.getApplicationMenu()!.getMenuItemById("workbench.settings.open")!;
      if (!settings.enabled) throw new Error("Settings should be enabled in the workbench");
      settings.click({}, BrowserWindow.getFocusedWindow(), webContents.getFocusedWebContents());
    });
    await expect
      .poll(() => window.evaluate(() => Reflect.get(globalThis, "receivedCommands")))
      .toEqual(["workbench.settings.open"]);
    expect(await window.evaluate(() => Reflect.get(globalThis, "stopDesktopCommands")())).toBeUndefined();
  });
  await test.step("keeps native editing actions attached to the focused workbench", async () => {
    const draft = window.getByRole("textbox", { name: "Draft" });
    await draft.pressSequentially("Unsaved draft");
    for (const [role, value] of [
      ["undo", ""],
      ["redo", "Unsaved draft"],
    ]) {
      await electronApp.evaluate(({ Menu, BrowserWindow, webContents }, role) => {
        const item = Menu.getApplicationMenu()!
          .items.find((item) => item.label === "Edit")!
          .submenu!.items.find((item) => item.role === role)!;
        if (process.platform === "darwin") {
          // Cocoa runs native menu roles; calling the JS click handler does not invoke them.
          Menu.sendActionToFirstResponder(`${item.role}:`);
          return;
        }
        item.click({}, BrowserWindow.getFocusedWindow(), webContents.getFocusedWebContents());
      }, role);
      await expect(draft).toHaveValue(value);
    }
  });
};
