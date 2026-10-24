import { expect, type Page } from "@playwright/test";
import { logTestPhase } from "../scripts/log-test-phase";

export const expectPackagedChatHistory = async (page: Page, sessionId: string) => {
  const isOpen = () =>
    page.evaluate((id) => {
      const workbench = (
        window as Window & {
          __pstdioDashboardWorkbench?: {
            host: {
              getOpenPlacementIds(): ReadonlySet<string>;
              getOpenPlacements(): { widgetId: string; resource?: { id: string } }[];
            };
          };
        }
      ).__pstdioDashboardWorkbench;
      if (!workbench) return false;
      const placement = workbench.host.getOpenPlacements().find((entry) => entry.resource?.id === id);
      return Boolean(placement && workbench.host.getOpenPlacementIds().has(placement.widgetId));
    }, sessionId);
  expect(await isOpen()).toBe(true);
  logTestPhase("Packaged chat history: sticky position");
  const replayTab = page.getByRole("tab", { name: "Motion replay", exact: true });
  const instanceId = await replayTab.locator("..").getAttribute("data-workbench-tab");
  const log = page.locator(`[data-workbench-instance="${instanceId}"]`).getByRole("log", { includeHidden: true });
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
    await expect.poll(isOpen).toBe(true);
    await expect(replayTab).toHaveAttribute("aria-selected", "false");
    await expect(log).toBeAttached();
    logTestPhase("Packaged chat history: reopen");
    await page.getByRole("option", { name: "Motion replay", exact: true }).click();
    await expect.poll(isOpen).toBe(true);
    await expect(replayTab).toHaveAttribute("aria-selected", "true");
    // Switching collection tabs preserves the existing view and reading position.
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
    await page.reload();
    await expect.poll(isOpen).toBe(true);
    await expect(page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
    await expect(page.locator('[data-workbench-panel="main"]').getByRole("tab")).toHaveCount(2);
  } finally {
    await page.unroute(route);
  }
};
