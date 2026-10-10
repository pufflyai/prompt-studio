import { expect, type Page, request } from "@playwright/test";
import { installShortcutReferenceExtension } from "../ui/helpers/shortcut-reference-extension";
import { showSidenavEntry } from "../ui/helpers/sidenav-navigation";

export const verifyPackagedShortcutReference = async (
  page: Page,
  origin: string,
  projectId: string,
  headers: Record<string, string>,
) => {
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
  await expect(dialog.getByRole("menuitem", { name: /Shortcut greeting/ })).toHaveCount(1);
  await expect(dialog.getByRole("group", { name: "Shortcut reference", exact: true })).toBeVisible();
  await expect(dialog.getByRole("menuitem", { name: /Open shortcut destination/ })).toContainText(/J/i);
  await expect(dialog.getByText("https://example.com/shortcuts", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close Keyboard shortcuts", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByText("Search", { exact: true }).first().click();
  const palette = page.getByRole("dialog").last();
  for (const [label, key] of [
    ["Open workspaces", "W"],
    ["Open sessions", "S"],
    ["New workspace", "W"],
    ["Open settings", ","],
    ["Shortcut greeting", "g"],
  ]) {
    await palette.locator("input").fill(`>${label}`);
    const entry = palette.getByRole("option", { name: new RegExp(label) });
    await expect(entry.locator("kbd").last()).toHaveText(key);
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
