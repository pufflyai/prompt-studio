import { expect, type Page } from "@playwright/test";

export const expectPackagedChatHistory = async (page: Page, sessionId: string) => {
  const log = page.getByRole("log").last();
  const viewport = log.locator('[data-scope="scroll-area"][data-part="viewport"]').first();
  await viewport.evaluate((element) => {
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
    element.scrollTop = element.scrollHeight / 2;
  });
  await expect
    .poll(() =>
      viewport.evaluate((element) => {
        const user = element.querySelector('[data-chat-message-list-item="user"]')!;
        return Math.abs(user.getBoundingClientRect().top - element.getBoundingClientRect().top);
      }),
    )
    .toBeLessThan(20);
  const gaps = await viewport.evaluate(async (element) => {
    const values: number[] = [];
    for (const direction of [1, -1])
      for (let frame = 0; frame < 20; frame++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        element.scrollTop += direction * 4;
        const user = element.querySelector('[data-chat-message-list-item="user"]')!;
        values.push(Math.abs(user.getBoundingClientRect().top - element.getBoundingClientRect().top));
      }
    return values;
  });
  expect(Math.max(...gaps)).toBeLessThan(20);

  let historyReads = 0;
  const route = `**/v1/sessions/${sessionId}/conversation`;
  await page.route(route, async (request) => {
    historyReads++;
    await request.continue();
  });
  try {
    await page.getByRole("option", { name: "Idle connection", exact: true }).click();
    await expect(log.locator('[data-chat-message-list-item="response"]').first()).toBeAttached();
    await page.getByRole("option", { name: "Motion replay", exact: true }).click();
    // Each resource page restores its existing view and reading position.
    await expect
      .poll(() =>
        viewport.evaluate((element) => {
          const user = element.querySelector('[data-chat-message-list-item="user"]')!;
          return Math.abs(user.getBoundingClientRect().top - element.getBoundingClientRect().top);
        }),
      )
      .toBeLessThan(20);
    await page.getByRole("button", { name: "Scroll to latest message", exact: true }).click();
    await expect(page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
    expect(historyReads).toBe(0);
  } finally {
    await page.unroute(route);
  }
};
