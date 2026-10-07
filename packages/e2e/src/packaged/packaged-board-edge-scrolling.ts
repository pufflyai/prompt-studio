import { expect, type Page } from "@playwright/test";

export const verifyBoardEdgeScrolling = async (page: Page) => {
  const card = page.getByTestId("renderer-card").filter({ hasText: "Edge scroll ticket" });
  const backlog = page.getByTestId("board-column-backlog");
  const viewport = page.locator('[data-scope="scroll-area"][data-part="viewport"]').filter({ has: backlog }).last();
  const bounds = await viewport.boundingBox();
  const cardBounds = await card.boundingBox();
  if (!bounds || !cardBounds) throw new Error("Board or card has no bounds");
  const y = cardBounds.y + cardBounds.height / 2;
  const readScroll = () => viewport.evaluate((element) => element.scrollLeft);
  const moveTo = async (x: number) => {
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.move(x, y);
  };

  await page.mouse.move(cardBounds.x + cardBounds.width / 2, y);
  await page.mouse.down();
  try {
    await moveTo(bounds.x + bounds.width - 48);
    await expect.poll(readScroll).toBeGreaterThan(100);

    await moveTo(bounds.x + bounds.width / 2);
    await page.waitForTimeout(150);
    const centered = await readScroll();
    await page.waitForTimeout(200);
    expect(await readScroll()).toBe(centered);

    await moveTo(bounds.x + bounds.width - 48);
    await expect.poll(readScroll).toBeGreaterThan(centered + 60);
    await moveTo(page.viewportSize()!.width + 50);
    await page.waitForTimeout(150);
    const outside = await readScroll();
    const maxScroll = await viewport.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(outside).toBeLessThan(maxScroll - 100);
    await page.waitForTimeout(200);
    expect(await readScroll()).toBe(outside);

    await moveTo(bounds.x + 48);
    await expect.poll(readScroll).toBeLessThan(centered - 80);
    await expect.poll(readScroll).toBe(0);

    await moveTo(bounds.x + bounds.width - 48);
    await expect.poll(readScroll).toBeGreaterThan(100);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    const cancelled = await readScroll();
    await page.waitForTimeout(200);
    expect(await readScroll()).toBe(cancelled);

    await card.scrollIntoViewIfNeeded();
    const restartBounds = await card.boundingBox();
    if (!restartBounds) throw new Error("Card has no bounds after cancellation");
    await page.mouse.move(restartBounds.x + restartBounds.width / 2, y);
    await page.mouse.down();
    await moveTo(bounds.x + bounds.width - 48);
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft))
      .toBeLessThan(2);
    const done = page.getByTestId("board-column-done");
    const doneBounds = await done.boundingBox();
    if (!doneBounds) throw new Error("Done column has no bounds");
    await moveTo(doneBounds.x + doneBounds.width / 2);
  } finally {
    await page.mouse.up();
  }
  await expect(page.getByTestId("board-column-done").getByText("Edge scroll ticket", { exact: true })).toBeVisible();
  const released = await readScroll();
  await moveTo(bounds.x + 48);
  await page.waitForTimeout(200);
  expect(await readScroll()).toBe(released);
};
