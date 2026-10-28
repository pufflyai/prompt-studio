import { expect, type Page, request } from "@playwright/test";
import { installShortcutReferenceExtension } from "../ui/helpers/shortcut-reference-extension";
import { showSidenavEntry } from "../ui/helpers/sidenav-navigation";

export const verifyPackagedShortcutReference = async (
  page: Page,
  origin: string,
  projectId: string,
  headers: Record<string, string>,
) => {
  const shortcuts = [
    { label: "Go to workspaces", key: "W", layered: true },
    { label: "Go to sessions", key: "S", layered: true },
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
  for (const { label, key } of shortcuts) {
    const shortcut = dialog.getByRole("group", { name: label, exact: true });
    await shortcut.scrollIntoViewIfNeeded();
    await expect(shortcut.locator("kbd").last()).toHaveText(key);
  }
  await dialog.getByRole("button", { name: "Close Keyboard shortcuts", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByText("Search", { exact: true }).first().click();
  const palette = page.getByRole("dialog").last();
  for (const { label, key, layered } of shortcuts) {
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
