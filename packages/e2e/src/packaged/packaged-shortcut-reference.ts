import { expect, type Page } from "@playwright/test";
import { installShortcutReferenceExtension } from "../ui/helpers/shortcut-reference-extension";

export const verifyPackagedShortcutReference = async (page: Page, origin: string, projectId: string) => {
  await installShortcutReferenceExtension(page.request, origin, projectId);
  await page.reload();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Keyboard shortcuts/ }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByRole("menuitem", { name: /Shortcut greeting/ })).toHaveCount(1);
  await expect(dialog.getByRole("menuitem", { name: /Unassigned greeting/ })).toContainText("Not assigned");
  await expect(dialog.getByRole("menuitem", { name: /Open shortcut destination/ })).toContainText(/J/i);
  await expect(dialog.getByText("https://example.com/shortcuts", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
};
