import { expect, type Page, request } from "@playwright/test";
import { installShortcutReferenceExtension } from "../ui/helpers/shortcut-reference-extension";

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
  await page.goto(`${origin}/projects/${projectId}/extensions/e2e.shortcut-reference/reference`);
  const navigation = page.getByRole("option", { name: /Open shortcut destination/ }).first();
  await navigation.hover();
  await expect(navigation.locator("kbd").last()).toBeVisible();
};
