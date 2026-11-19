import { expect, type Locator, type Page } from "@playwright/test";

export const verifyChatFilePreview = async (page: Page, link: Locator) => {
  const conversationUrl = page.url();
  await link.click();
  const side = page.locator('[data-workbench-panel="side"]:visible');
  await expect(page).toHaveURL(conversationUrl);
  await expect(side.locator(".monaco-editor .view-lines")).toContainText("export");
  await expect(side.getByRole("tab", { selected: true })).toHaveCSS("font-style", "italic");
  await expect(link).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(conversationUrl);
  await expect(side.locator(".monaco-editor .view-lines")).toContainText("export");
  await side.getByRole("tab", { selected: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  await expect(link).toBeVisible();
};
