import { expect, type Page } from "@playwright/test";
import { switchSession } from "../helpers/session-side-panel";
import { logTestPhase } from "../scripts/log-test-phase";

export const expectPackagedChatHistory = async (page: Page, sessionId: string) => {
  logTestPhase("Packaged chat history: sticky position");
  const side = page.locator('[data-workbench-panel="side"]');
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
    await side.getByRole("button", { name: "Add panel", exact: true }).click();
    await page.getByRole("menuitem", { name: "New session", exact: true }).click();
    await side.getByRole("tab", { name: "New session", exact: true }).click({ button: "right" });
    await switchSession(page, "Idle connection");
    await expect(replayTab).toHaveAttribute("aria-selected", "false");
    await expect(log).toBeAttached();
    logTestPhase("Packaged chat history: reopen");
    await replayTab.click();
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
    await expect(page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
    await expect(side.getByRole("tab")).toHaveCount(2);
  } finally {
    await page.unroute(route);
  }
};
