import { test } from "@playwright/test";
import type { PackagedApp } from "./packaged-app-helpers";

// Read only after the visibility assertion fails, outside successful measurement windows.
export const attachStreamingReplayFailure = async (app: PackagedApp, sessionId: string) => {
  const captures = await Promise.allSettled([
    (async () => {
      const response = await fetch(`${app.runtime.origin}/v1/sessions/${sessionId}/conversation`, {
        headers: { authorization: `Bearer ${app.runtime.token}` },
        signal: AbortSignal.timeout(1000),
      });
      await test.info().attach("streaming-authoritative-conversation.json", {
        contentType: "application/json",
        body: JSON.stringify({ status: response.status, conversation: await response.json() }, null, 2),
      });
    })(),
    (async () => {
      const geometry = await app.page.locator('[aria-label="Main"]:visible').evaluate((main) => {
        const rectangle = (element: Element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          url: location.href,
          // A retained conversation can keep a hidden log before the visible one.
          logs: Array.from(main.querySelectorAll<HTMLElement>('[role="log"]')).map((log) => ({
            visible: log.checkVisibility(),
            rectangle: rectangle(log),
            viewports: Array.from(log.querySelectorAll('[data-scope="scroll-area"][data-part="viewport"]')).map(
              (element) => ({
                scrollTop: element.scrollTop,
                scrollHeight: element.scrollHeight,
                clientHeight: element.clientHeight,
                rectangle: rectangle(element),
              }),
            ),
            content: Array.from(log.querySelectorAll('[data-scope="scroll-area"][data-part="content"]')).map(rectangle),
            rows: Array.from(log.querySelectorAll<HTMLElement>("[data-chat-message-list-item]")).map((element) => ({
              id: element.dataset.chatMessageId,
              index: element.dataset.index,
              top: element.style.top,
              text: element.textContent?.slice(0, 160),
              rectangle: rectangle(element),
              virtualListHeight: element.parentElement?.style.height,
            })),
            scrollButtonPresent: Boolean(log.querySelector('[aria-label="Scroll to latest message"]')),
          })),
        };
      });
      await test.info().attach("streaming-rendered-conversation.json", {
        contentType: "application/json",
        body: JSON.stringify(geometry, null, 2),
      });
    })(),
    (async () => {
      await test.info().attach("streaming-viewport.png", {
        contentType: "image/png",
        body: await app.page.screenshot(),
      });
    })(),
  ]);
  for (const capture of captures)
    if (capture.status === "rejected") console.error("Streaming failure evidence:", capture.reason);
};
