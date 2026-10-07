import { expect, type Page } from "@playwright/test";

export const verifyBoardPanning = async (page: Page, columnId = "backlog") => {
  const column = page.getByTestId(`board-column-${columnId}`);
  await expect(column).toBeVisible();
  const viewport = page.locator('[data-scope="scroll-area"][data-part="viewport"]').filter({ has: column }).last();
  const bounds = await column.boundingBox();
  if (!bounds) throw new Error("Board column has no bounds");

  const y = bounds.y + bounds.height - 40;
  const x = bounds.x + 200;
  const readScroll = () => viewport.evaluate((element) => element.scrollLeft);
  await expect.poll(() => viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const initial = await readScroll();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 140, y, { steps: 8 });
  await expect.poll(readScroll).toBeGreaterThan(initial + 100);
  await page.mouse.up();

  const released = await readScroll();
  await page.mouse.move(x - 200, y);
  await expect.poll(readScroll).toBe(released);

  await page.mouse.move(x - 140, y);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(readScroll).toBe(initial);

  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x - 140, y, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await expect.poll(readScroll).toBe(initial);
};
