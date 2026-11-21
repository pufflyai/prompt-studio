import { expect, type Locator, type Page } from "@playwright/test";

export const verifyChatFilePreview = async (page: Page, link: Locator) => {
  const conversationUrl = page.url();
  await link.click();
  const side = page.locator('[data-workbench-panel="side"]:visible');
  await expect(page).toHaveURL(conversationUrl);
  // User-approved 2026-11-20 (#2241): a cold Monaco start took ~5.1 s of main-thread time on the Windows runner (run 44775675600).
  await expect(side.locator(".monaco-editor .view-lines")).toContainText("export", { timeout: 20_000 });
  await expect(side.getByRole("tab", { selected: true })).toHaveCSS("font-style", "italic");
  await expect(link).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(conversationUrl);
  // User-approved 2026-11-20 (#2241): a cold Monaco start took ~5.1 s of main-thread time on the Windows runner (run 44775675600).
  await expect(side.locator(".monaco-editor .view-lines")).toContainText("export", { timeout: 20_000 });
  await side.getByRole("tab", { selected: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  await expect(link).toBeVisible();
};
