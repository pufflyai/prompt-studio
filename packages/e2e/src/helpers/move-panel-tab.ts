import { expect, type Locator, type Page } from "@playwright/test";

export const movePanelTab = async (page: Page, tab: Locator, target: Locator) => {
  await expect(tab).toBeVisible();
  await expect(target).toBeVisible();
  let previous = "";
  await expect
    .poll(async () => {
      const current = JSON.stringify(await target.boundingBox());
      const stable = current === previous;
      previous = current;
      return stable;
    })
    .toBe(true);
  const source = (await tab.boundingBox())!;
  const end = (await target.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 3 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
};
