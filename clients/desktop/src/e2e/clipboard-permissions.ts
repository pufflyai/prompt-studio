import { type ElectronApplication, expect, type Page, test } from "@playwright/test";

export const expectClipboardPermissions = async (electronApp: ElectronApplication, window: Page) => {
  await test.step("copies message text through the browser clipboard API", async () => {
    const message = "The change is complete.\n\nRun `bun run validate`.";
    const nativeMessage = process.platform === "win32" ? message.replaceAll("\n", "\r\n") : message;
    await window.evaluate((text) => {
      const button = document.createElement("button");
      button.textContent = "Copy message";
      button.onclick = async () => {
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = "Copied";
        } catch (error) {
          button.textContent = String(error);
        }
      };
      document.body.append(button);
    }, message);
    await window.getByRole("button", { name: "Copy message", exact: true }).click();
    await expect(window.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
    expect(await electronApp.evaluate(({ clipboard }) => clipboard.readText())).toBe(nativeMessage);
    expect(
      await window.evaluate(() =>
        navigator.clipboard.readText().then(
          () => "allowed",
          () => "denied",
        ),
      ),
    ).toBe("denied");
    await window.evaluate(() => {
      const frame = document.createElement("iframe");
      frame.title = "Embedded copy request";
      frame.srcdoc = "<!doctype html><button>Copy embedded text</button>";
      document.body.append(frame);
    });
    const embeddedCopy = window.frameLocator('iframe[title="Embedded copy request"]').getByRole("button");
    await embeddedCopy.evaluate((button) => {
      button.onclick = async () => {
        button.textContent = await navigator.clipboard.writeText("Embedded text").then(
          () => "allowed",
          () => "denied",
        );
      };
    });
    await embeddedCopy.click();
    await expect(embeddedCopy).toHaveText("denied");
    expect(await electronApp.evaluate(({ clipboard }) => clipboard.readText())).toBe(nativeMessage);
  });
};
