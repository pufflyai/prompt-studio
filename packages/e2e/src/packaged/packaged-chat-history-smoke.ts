import { expect, type Page } from "@playwright/test";
import { switchSession } from "../helpers/session-side-panel";
import { logTestPhase } from "../scripts/log-test-phase";
import { expectPackagedChatOverflowRecovery, installChatOverflowReplay } from "./packaged-chat-overflow-smoke";

export const expectPackagedChatHistory = async (
  page: Page,
  sessionId: string,
  baseUrl: string,
  headers: Record<string, string>,
) => {
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
  const route = "**/extensions/commands/pstdio.pstdio-session-browser.view.conversation.chat.query/execute";
  await page.route(route, async (request) => {
    if (request.request().postDataJSON()?.params?.renderer?.resource?.id === sessionId) historyReads++;
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
          const user = element.querySelector('[data-chat-message-list-item="user"]');
          return user
            ? Math.abs(user.getBoundingClientRect().top - element.getBoundingClientRect().top)
            : Number.POSITIVE_INFINITY;
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
    // Abort the real fetch response body at a known point. Browser offline
    // emulation does not reliably terminate an already-open idle SSE response.
    await page.addInitScript(() => {
      const fetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
        if (url.pathname !== "/v1/session-stream") return fetch(input, init);
        const interrupt = new AbortController();
        Reflect.set(window, "interruptChatStream", () => interrupt.abort());
        return fetch(input, {
          ...init,
          signal: init?.signal ? AbortSignal.any([init.signal, interrupt.signal]) : interrupt.signal,
        });
      };
    });
    await installChatOverflowReplay(page, sessionId);
    await page.reload();
    await expect(page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
    await expect(side.getByRole("tab")).toHaveCount(2);
    logTestPhase("Packaged chat history: recover overflow without an error alert");
    await expectPackagedChatOverflowRecovery(page, sessionId, baseUrl, headers);
    logTestPhase("Packaged chat history: recover observation after connection loss");
    const retry = page.getByRole("alert").getByRole("button", { name: "Retry", exact: true });
    await page.evaluate(() => Reflect.get(window, "interruptChatStream")());
    await expect(retry).toBeVisible();
    await expect(page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
    const refreshed = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes("/extensions/commands/pstdio.pstdio-session-browser.view.conversation.chat.query/execute") &&
        response.request().postDataJSON()?.params?.renderer?.resource?.id === sessionId,
    );
    await retry.click();
    expect((await refreshed).ok()).toBe(true);
    await expect(retry).toBeHidden();
    await expect(page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
    await expect(side.getByRole("tab")).toHaveCount(2);
    // A new fake-harness turn proves the replacement observation is receiving
    // canonical updates; retained DOM and clearing Retry alone cannot prove it.
    const followup = "Reply after the connection recovered";
    const response = await fetch(`${baseUrl}/v1/sessions/${sessionId}/follow-up`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ prompt: followup }),
    });
    expect(response.ok).toBe(true);
    await expect(page.getByText(followup, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(
      page.getByText(`Fake Agent: follow-up "${followup}"`, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
  } finally {
    await page.unroute(route);
  }
};
