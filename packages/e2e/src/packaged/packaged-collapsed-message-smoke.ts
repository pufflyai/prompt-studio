import { expect, type Locator, type Page } from "@playwright/test";

export const expectPackagedCollapsedMessage = async (page: Page, editor: Locator) => {
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 600, height: 800 });
  const prompt =
    "Please review the release checklist and explain each remaining risk. Include the current status, the responsible owner, the next action, and the validation evidence for every item. Keep the summary useful for someone who has not read the source code.";
  await editor.fill(prompt);
  await editor.press("Enter");
  // Read the saved turn after it replaces the temporary submission in the conversation.
  await expect(page.getByText(`Fake Agent: follow-up "${prompt}"`, { exact: true })).toBeVisible();
  const more = page.getByRole("button", { name: "Show more", exact: true }).last();
  await expect(more).toBeVisible();
  const bubble = more.locator("xpath=ancestor::div[contains(@class, 'ai-message__content')]");
  const contentOverlapsControls = await bubble.evaluate((node) => {
    const footer = node.lastElementChild!;
    const content = node.querySelector("[data-sticky-user-message-content]")!;
    return content.getBoundingClientRect().bottom > footer.getBoundingClientRect().top;
  });
  expect(contentOverlapsControls).toBe(false);
  await more.click();
  const less = page.getByRole("button", { name: "Show less", exact: true }).last();
  await expect(less).toBeVisible();
  const expandedBubble = less.locator("xpath=ancestor::div[contains(@class, 'ai-message__content')]");
  await expect(expandedBubble.locator('[data-sticky-user-message-content="expanded"]')).toHaveAttribute(
    "data-scope",
    "scroll-area",
  );
  await less.click();
  await expect(more).toBeVisible();
  await page.setViewportSize(viewport);
};
