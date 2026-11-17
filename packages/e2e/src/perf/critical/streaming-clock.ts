import type { Page } from "@playwright/test";

export interface StreamClock {
  visible: boolean;
  received: number;
  paints: { text: string; received: number; painted: number }[];
  frames: number[];
  tasks: number[];
}
declare global {
  interface Window {
    criticalStream: StreamClock;
  }
}

/** Observe the application's existing stream body; do not open a second transport or profile CPU. */
export const installStreamingClock = (page: Page) =>
  page.addInitScript(() => {
    if (window !== window.top) return;
    const clock: StreamClock = { visible: false, received: 0, paints: [], frames: [], tasks: [] };
    window.criticalStream = clock;
    let last = performance.now();
    const frame = () => {
      const now = performance.now();
      clock.frames.push(now - last);
      last = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    new PerformanceObserver((list) => clock.tasks.push(...list.getEntries().map((entry) => entry.duration))).observe({
      type: "longtask",
      buffered: true,
    });
    const pending: { text: string; received: number }[] = [];
    let scheduled = false;
    const paint = () => {
      if (scheduled || !pending.length) return;
      scheduled = true;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          scheduled = false;
          const text = document.body.textContent ?? "";
          for (let index = pending.length - 1; index >= 0; index--) {
            const entry = pending[index]!;
            if (text.includes(entry.text)) {
              clock.paints.push({ ...entry, painted: performance.now() });
              pending.splice(index, 1);
            }
          }
          if (!clock.visible) pending.length = 0;
        }),
      );
    };
    new MutationObserver(paint).observe(document, { subtree: true, childList: true, characterData: true });
    const collect = (value: unknown, received: number) => {
      if (!value || typeof value !== "object") return;
      if ("text" in value && typeof value.text === "string" && /^Step \d+\./.test(value.text)) {
        clock.received++;
        if (clock.visible) pending.push({ text: value.text, received });
      }
      for (const item of Object.values(value)) if (item && typeof item === "object") collect(item, received);
    };
    const original = window.fetch.bind(window);
    Reflect.set(window, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await original(input, init);
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (url.pathname !== "/v1/session-stream" || !response.body) return response;
      const decoder = new TextDecoder();
      let buffered = "";
      const observed = response.body.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            buffered += decoder.decode(chunk, { stream: true }).replaceAll("\r\n", "\n");
            let boundary = buffered.indexOf("\n\n");
            while (boundary >= 0) {
              const event = buffered.slice(0, boundary);
              buffered = buffered.slice(boundary + 2);
              if (event.split("\n").includes("event: patch")) {
                const data = event
                  .split("\n")
                  .filter((line) => line.startsWith("data: "))
                  .map((line) => line.slice(6))
                  .join("\n");
                collect(JSON.parse(data), performance.now());
              }
              boundary = buffered.indexOf("\n\n");
            }
            controller.enqueue(chunk);
          },
        }),
      );
      return new Response(observed, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    });
  });
