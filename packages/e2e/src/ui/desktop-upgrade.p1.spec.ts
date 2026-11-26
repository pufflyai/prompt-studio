import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

// Critical risks: installing before download completion or without consent, and losing widget keyboard placement.
test("shows a downloaded update as a movable status widget and asks before restarting", async ({ page, request }) => {
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name: "Desktop update" }) });
  expect(response.ok()).toBe(true);
  const { id } = (await response.json()) as { id: string };

  try {
    await page.addInitScript(() => {
      if (window.top !== window) return;
      let notify: (() => void) | undefined;
      const downloading = () => {
        sessionStorage.setItem("fixture.update", "downloading");
        notify?.();
      };
      window.addEventListener("desktop-update-downloaded", () => {
        sessionStorage.setItem("fixture.update", "ready");
        notify?.();
      });
      Object.assign(window, {
        promptStudioDesktop: {
          getAppInfo: async () => ({ platform: "darwin" }),
          getProjectTabs: async () => ({ projectIds: [location.pathname.split("/")[2]] }),
          setProjectTabs: async () => undefined,
          getWorkbenchState: async () => ({
            values: JSON.parse(sessionStorage.getItem("fixture.layout") ?? "{}"),
          }),
          setWorkbenchItem: async (key: string, value: string | null) => {
            const values = JSON.parse(sessionStorage.getItem("fixture.layout") ?? "{}");
            if (value === null) delete values[key];
            else values[key] = value;
            sessionStorage.setItem("fixture.layout", JSON.stringify(values));
          },
          onUpdateNotice: (listener: () => void) => {
            notify = listener;
            return () => {
              notify = undefined;
            };
          },
          takeUpdateNotice: async () => {
            const status = sessionStorage.getItem("fixture.update");
            return {
              kind: "progress",
              title: status === "downloading" ? "Downloading update…" : null,
              upgrade: status === "ready" ? { version: "0.49.0" } : null,
            };
          },
          checkForUpdates: async () => downloading(),
          restartToInstallUpdate: async () => sessionStorage.setItem("fixture.restart", "requested"),
        },
      });
    });
    await page.goto(`/projects/${id}/`);
    await expect(page.getByRole("tab", { name: "Desktop update" })).toHaveAttribute("aria-selected", "true");
    const button = page.locator("footer").getByRole("button", { name: "Update available", exact: true });
    const widget = page.locator('[data-status-bar-item="desktop.upgrade"]');
    const confirmation = page.getByRole("alertdialog", { name: "Restart app to install upgrade?" });
    await expect(button).toHaveCount(0);

    await page.evaluate(() => Reflect.get(window, "promptStudioDesktop").checkForUpdates());
    await expect(page.locator("footer")).toContainText("Downloading update");
    await expect(button).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);

    await page.evaluate(() => window.dispatchEvent(new Event("desktop-update-downloaded")));
    await expect(button).toBeVisible();
    await expect(widget).toHaveAttribute("data-status-bar-slot", "leading");
    await expect(confirmation).toHaveCount(0);
    await button.click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Later" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeHidden();
    expect(await page.evaluate(() => sessionStorage.getItem("fixture.restart"))).toBeNull();

    await widget.focus();
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await expect(widget).toHaveAttribute("data-status-bar-slot", "trailing");
    await page.reload();
    await expect(button).toBeVisible();
    await expect(widget).toHaveAttribute("data-status-bar-slot", "trailing");
    await expect(confirmation).toHaveCount(0);
    await button.click();
    await expect(confirmation).toBeVisible();
    await page.keyboard.press("y");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("fixture.restart"))).toBe("requested");
  } finally {
    await request.delete(`/v1/projects/${id}`);
  }
});
