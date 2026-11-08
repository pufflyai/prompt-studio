import { expect, type Page, request, test } from "@playwright/test";
import { installShortcutReferenceExtension } from "../ui/helpers/shortcut-reference-extension";
import { showSidenavEntry } from "../ui/helpers/sidenav-navigation";

export const verifyPackagedShortcutReference = async (
  page: Page,
  origin: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  const navigationShortcuts = [
    { label: "Go to workspaces", key: "W" },
    { label: "Go to sessions", key: "S" },
  ];
  const commands = [
    { label: "New workspace", key: "W", layered: true },
    { label: "Open settings", key: ",", layered: false },
    { label: "Shortcut greeting", key: "g", layered: false },
  ];
  const api = await request.newContext({ extraHTTPHeaders: headers });
  try {
    await installShortcutReferenceExtension(api, origin, projectId);
  } finally {
    await api.dispose();
  }
  await page.reload();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Keyboard shortcuts/ }).click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByText("Keyboard shortcuts", { exact: true }) });
  await expect(dialog.getByRole("group", { name: "Shortcut greeting", exact: true })).toHaveCount(1);
  await dialog.getByRole("group", { name: "Go to shortcut destination", exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("heading", { name: "Shortcut reference", exact: true })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Go to shortcut destination", exact: true })).toContainText(/J/i);
  await expect(dialog.getByText("https://example.com/shortcuts", { exact: true })).toBeVisible();
  for (const { label, key } of [...navigationShortcuts, ...commands]) {
    const shortcut = dialog.getByRole("group", { name: label, exact: true });
    await shortcut.scrollIntoViewIfNeeded();
    await expect(shortcut.locator("kbd").last()).toHaveText(key);
  }
  await dialog.getByRole("button", { name: "Close Keyboard shortcuts", exact: true }).click();
  try {
    await expect(dialog).not.toBeVisible();
  } catch (error) {
    try {
      const presence = await dialog.evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          return {
            state: element.getAttribute("data-state"),
            hidden: element.hasAttribute("hidden"),
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            animationPlayState: style.animationPlayState,
            opacity: style.opacity,
            visibility: style.visibility,
            animations: element.getAnimations().map((animation) => ({
              playState: animation.playState,
              currentTime: animation.currentTime,
              timing: animation.effect?.getComputedTiming(),
            })),
          };
        }),
      );
      await test.info().attach("shortcut-dialog-presence", {
        body: JSON.stringify(presence, null, 2),
        contentType: "application/json",
      });
    } catch {
      // Preserve the assertion if the page closed before diagnostics completed.
    }
    throw error;
  }
  await page.getByText("Search", { exact: true }).first().click();
  const palette = page.getByRole("dialog").last();
  for (const { label, key, layered } of commands) {
    await palette.locator("input").fill(`>${label}`);
    const entry = palette.getByRole("option", { name: new RegExp(label) });
    await expect(entry).toBeVisible();
    // Layer shortcuts appear in the reference; palette hints describe keys usable
    // in the current mode, which is outside shortcut mode here.
    if (layered) await expect(entry.locator("kbd")).toHaveCount(0);
    else await expect(entry.locator("kbd").last()).toHaveText(key);
  }
  await palette.locator("input").fill("");
  await page.keyboard.press("Escape");
  await expect(palette).not.toBeVisible();
  await page.goto(`${origin}/projects/${projectId}/extensions/e2e.shortcut-reference/reference`);
  await showSidenavEntry(page, "Workspaces");
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Help", exact: true }).focus();
  const workspaceLabel = page.getByRole("option", { name: "Workspaces", exact: true }).getByText("Workspaces");
  await expect.poll(() => workspaceLabel.evaluate((label) => label.clientWidth >= label.scrollWidth)).toBe(true);
};
