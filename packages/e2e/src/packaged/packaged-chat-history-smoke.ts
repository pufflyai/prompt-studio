import { expect, type Page } from "@playwright/test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { logTestPhase } from "../scripts/log-test-phase";

export const expectPackagedChatHistory = async (page: Page, sessionId: string) => {
  const isOpen = () =>
    page.evaluate((id) => {
      const workbench = (
        window as Window & {
          __pstdioDashboardWorkbench: {
            host: {
              getOpenPlacementIds(): ReadonlySet<string>;
              getOpenPlacements(): { widgetId: string; resource?: { id: string } }[];
            };
          };
        }
      ).__pstdioDashboardWorkbench;
      const placement = workbench.host.getOpenPlacements().find((entry) => entry.resource?.id === id);
      return Boolean(placement && workbench.host.getOpenPlacementIds().has(placement.widgetId));
    }, sessionId);
  expect(await isOpen()).toBe(true);
  logTestPhase("Packaged chat history: sticky position");
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
  logTestPhase("Packaged chat history: switch away");

  let historyReads = 0;
  const route = `**/v1/sessions/${sessionId}/conversation`;
  await page.route(route, async (request) => {
    historyReads++;
    await request.continue();
  });
  try {
    await page.getByRole("option", { name: "Idle connection", exact: true }).click();
    await expect.poll(isOpen).toBe(false);
    await expect(log.locator('[data-chat-message-list-item="response"]').first()).toBeAttached();
    logTestPhase("Packaged chat history: reopen");
    await page.getByRole("option", { name: "Motion replay", exact: true }).click();
    await expect.poll(isOpen).toBe(true);
    // Each resource page restores its existing view and reading position.
    await expect
      .poll(() =>
        viewport.evaluate((element) => {
          const user = element.querySelector('[data-chat-message-list-item="user"]')!;
          return Math.abs(user.getBoundingClientRect().top - element.getBoundingClientRect().top);
        }),
      )
      .toBeLessThan(20);
    logTestPhase(
      `Packaged chat history: restored position, latest controls=${await page.getByRole("button", { name: "Scroll to latest message", exact: true }).count()}`,
    );
    await page.getByRole("button", { name: "Scroll to latest message", exact: true }).click();
    logTestPhase("Packaged chat history: show final response");
    await expect(page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
    expect(historyReads).toBe(0);
    const overrides = await page.evaluate((pageId) => {
      const prefix = ":layout:workbench-main:";
      return Object.keys(localStorage).filter((key) => {
        const offset = key.indexOf(prefix);
        return offset >= 0 && JSON.parse(key.slice(offset + prefix.length))[2] === pageId;
      }).length;
    }, workbenchPages.session.id);
    expect(overrides).toBe(0);
  } finally {
    await page.unroute(route);
  }
};
