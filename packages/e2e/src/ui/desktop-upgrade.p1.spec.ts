import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";

// Exercise the dashboard with the native updater boundary supplied by the fixture.
test("shows a ready desktop upgrade and requires confirmation before requesting a restart", async ({
  page,
  request,
}) => {
  const response = await request.post("/v1/projects", { data: folderProjectInput({ name: "Desktop upgrade" }) });
  expect(response.ok()).toBe(true);
  const { id } = (await response.json()) as { id: string };

  try {
    await page.addInitScript(() => {
      if (window.top !== window) return;
      let notify: (() => void) | undefined;
      let prompt = false;
      window.addEventListener("desktop-upgrade-fixture", (event) => {
        sessionStorage.setItem("fixture.upgrade", "0.49.0");
        prompt = (event as CustomEvent<boolean>).detail;
        notify?.();
      });
      Object.assign(window, {
        promptStudioDesktop: {
          getAppInfo: async () => ({ platform: "darwin" }),
          getProjectTabs: async () => ({ projectIds: [location.pathname.split("/")[2]] }),
          setProjectTabs: async () => undefined,
          getWorkbenchState: async () => ({ values: {} }),
          setWorkbenchItem: async () => undefined,
          onUpdateNotice: (listener: () => void) => {
            notify = listener;
            return () => {
              notify = undefined;
            };
          },
          takeUpdateNotice: async () => {
            const version = sessionStorage.getItem("fixture.upgrade");
            const upgrade = { version, prompt };
            prompt = false;
            return version ? { kind: "progress", upgrade } : undefined;
          },
          restartToInstallUpdate: async () => sessionStorage.setItem("fixture.restart", "requested"),
        },
      });
    });
    await page.goto(`/projects/${id}/`);
    await expect(page.getByRole("tab", { name: "Desktop upgrade" })).toHaveAttribute("aria-selected", "true");
    const button = page.locator("footer").getByRole("button", { name: "Upgrade", exact: true });
    const confirmation = page.getByRole("alertdialog", { name: "Restart app to install upgrade?" });
    await expect(button).toHaveCount(0);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("desktop-upgrade-fixture", { detail: false })));
    await expect(button).toBeVisible();
    await expect(confirmation).toHaveCount(0);
    await button.click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Later" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeHidden();
    await expect(button).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("fixture.restart"))).toBeNull();

    await page.reload();
    await expect(button).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("desktop-upgrade-fixture", { detail: true })));
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Later" })).toBeFocused();
    await page.keyboard.press("y");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("fixture.restart"))).toBe("requested");
  } finally {
    await request.delete(`/v1/projects/${id}`);
  }
});
