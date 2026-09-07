import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { readRuntimeActivity } from "pstdio/runtime";
import { acceptFocusedButton } from "./lifecycle-actions";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
  runPackagedCli,
  waitForExit,
} from "./packaged-app-helpers";

for (const shutdown of ["desktop confirmation", "forced CLI close"] as const) {
  test(`protects a running terminal before ${shutdown}`, async () => {
    const home = createPackagedHome();
    let app: PackagedApp | null = null;
    try {
      app = await launchPackagedApp(home);
      const created = await app.page.evaluate(async () => {
        const response = await fetch("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Active terminal work" }),
        });
        return { status: response.status, body: await response.json() };
      });
      expect(created.status).toBe(201);
      expect(created.body.extension_warnings ?? []).toEqual([]);
      await app.page.getByText("Recent sessions", { exact: true }).waitFor();
      const socketOpened = app.page.waitForEvent(
        "websocket",
        (socket) => new URL(socket.url()).pathname === "/v1/terminal",
      );
      const showSecondary = app.page.getByRole("button", { name: "Show Secondary Panel" });
      if (await showSecondary.isVisible()) await showSecondary.click();
      await app.page
        .locator('[data-workbench-panel-header="secondary"]')
        .getByRole("button", { name: "Add panel" })
        .click();
      const socket = await socketOpened;
      expect(new URL(socket.url()).origin).toBe(app.runtime.origin.replace(/^http/, "ws"));
      const readTerminals = async () => (await readRuntimeActivity(app!.runtime)).terminals;
      await expect.poll(readTerminals).toHaveLength(1);
      const [activeTerminal] = await readTerminals();

      expect((await runPackagedCli(home, ["close"])).exitCode).toBe(1);
      expect(app.child.exitCode).toBeNull();
      const confirmationOpened = app.page.context().waitForEvent("page");
      await app.page.evaluate(() => void window.promptStudioDesktop.quitApp());
      const confirmation = await confirmationOpened;
      const dialog = confirmation.getByRole("alertdialog", { name: "Active work is still running" });
      await expect(dialog).toBeVisible();
      const keepOpen = dialog.getByRole("button", { name: "Keep Prompt Studio open" });
      await expect(keepOpen).toBeFocused();
      await acceptFocusedButton(confirmation);
      await expect(app.page.getByRole("textbox", { name: "Terminal input" })).toBeVisible();
      expect(existsSync(join(home, "runtime.json"))).toBe(true);
      await expect.poll(readTerminals).toEqual([activeTerminal]);

      if (shutdown === "desktop confirmation") {
        const nextConfirmationOpened = app.page.context().waitForEvent("page");
        await app.page.evaluate(() => void window.promptStudioDesktop.quitApp());
        const nextConfirmation = await nextConfirmationOpened;
        await expect(nextConfirmation.getByRole("button", { name: "Keep Prompt Studio open" })).toBeFocused();
        await nextConfirmation.keyboard.press("Tab");
        await expect(nextConfirmation.getByRole("button", { name: "Cancel work and quit" })).toBeFocused();
        await app.finishTrace();
        await acceptFocusedButton(nextConfirmation);
        await waitForExit(app.child);
      } else {
        await app.finishTrace();
        const closed = runPackagedCli(home, ["close", "--force"]);
        await waitForExit(app.child);
        expect((await closed).exitCode).toBe(0);
      }
      expect(existsSync(join(home, "runtime.json"))).toBe(false);
    } finally {
      await disposePackagedApp(app);
      removePackagedHome(home);
    }
  });
}
