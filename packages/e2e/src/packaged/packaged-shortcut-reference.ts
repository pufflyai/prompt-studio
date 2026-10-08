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
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("menuitem", { name: /Shortcut greeting/ })).toHaveCount(1);
  await expect(dialog.getByRole("menuitem", { name: /Unassigned greeting/ })).toContainText("Not assigned");
  await expect(dialog.getByRole("menuitem", { name: /Open shortcut destination/ })).toContainText(/J/i);
  await expect(dialog.getByText("https://example.com/shortcuts", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
};
