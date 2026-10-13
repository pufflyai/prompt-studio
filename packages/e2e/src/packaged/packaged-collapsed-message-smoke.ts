import { expect, type Locator, type Page } from "@playwright/test";

export const expectPackagedCollapsedMessage = async (page: Page, editor: Locator) => {
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 600, height: 800 });
  await editor.fill(
    "Please review the release checklist and explain each remaining risk. Include the current status, the responsible owner, the next action, and the validation evidence for every item. Keep the summary useful for someone who has not read the source code.",
  );
  await editor.press("Enter");
  const more = page.getByRole("button", { name: "Show more", exact: true }).last();
  await expect(more).toBeVisible();
  const bubble = more.locator("xpath=ancestor::div[contains(@class, 'ai-message__content')]");
  await expect(bubble).toHaveCSS("border-top-width", "0px");
  await expect.poll(() => bubble.evaluate((node) => node.getBoundingClientRect().height)).toBe(96);
  await more.click();
  const less = page.getByRole("button", { name: "Show less", exact: true }).last();
  await expect(less).toBeVisible();
  await less.click();
  await expect(more).toBeVisible();
  await page.setViewportSize(viewport);
};
