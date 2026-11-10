import { expect, type Page } from "@playwright/test";

/** Replay a failed observation outcome through the installed app's actual shared-stream client. */
export const installChatOverflowReplay = (page: Page, sessionId: string) =>
  page.addInitScript((sessionId) => {
    const fetch = window.fetch.bind(window);
    let subscriptionId: string | undefined;
    let sink: TransformStreamDefaultController<Uint8Array> | undefined;
    let watches = 0;
    Reflect.set(window, "chatOverflowReplay", {
      state: () => ({ ready: Boolean(subscriptionId && sink), watches }),
      overflow: () => {
        if (!subscriptionId || !sink) throw new Error("Conversation observation is not ready");
        const data = {
          subscription_id: subscriptionId,
          data: {
            outcome: { ok: false, status: "error", code: "command_stream_overflow", reason: "command_stream_overflow" },
          },
        };
        sink.enqueue(new TextEncoder().encode(`event: end\ndata: ${JSON.stringify(data)}\n\n`));
      },
    });
    Reflect.set(window, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (url.pathname.endsWith("/subscriptions") && init?.method === "POST" && typeof init.body === "string") {
        const body = JSON.parse(init.body);
        if (
          body.command?.command_id === "pstdio.pstdio-session-browser.command.watch" &&
          body.command.body?.params?.renderer?.resource?.id === sessionId
        ) {
          subscriptionId = body.subscription_id;
          watches++;
        }
      }
      const response = await fetch(input, init);
      if (url.pathname !== "/v1/session-stream" || !response.body) return response;
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let pending = "";
      return new Response(
        response.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            start(controller) {
              sink = controller;
            },
            transform(chunk, controller) {
              // Inject outcomes only between complete SSE events, never inside a split HTTP frame.
              pending += decoder.decode(chunk, { stream: true });
              const boundary = pending.lastIndexOf("\n\n");
              if (boundary < 0) return;
              controller.enqueue(encoder.encode(pending.slice(0, boundary + 2)));
              pending = pending.slice(boundary + 2);
            },
            flush(controller) {
              controller.enqueue(encoder.encode(pending + decoder.decode()));
            },
          }),
        ),
        { status: response.status, statusText: response.statusText, headers: response.headers },
      );
    });
  }, sessionId);

export const expectPackagedChatOverflowRecovery = async (
  page: Page,
  sessionId: string,
  baseUrl: string,
  headers: Record<string, string>,
) => {
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "chatOverflowReplay").state().ready)).toBe(true);
  const before = await page.evaluate(() => Reflect.get(window, "chatOverflowReplay").state().watches);
  await page.evaluate(() => {
    Reflect.set(window, "overflowAlerts", []);
    const observer = new MutationObserver(() => {
      for (const alert of document.querySelectorAll('[role="alert"]'))
        if (alert.textContent?.includes("command_stream_overflow"))
          Reflect.get(window, "overflowAlerts").push(alert.textContent);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    Reflect.set(window, "stopOverflowAlerts", () => observer.disconnect());
    Reflect.get(window, "chatOverflowReplay").overflow();
  });
  try {
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "chatOverflowReplay").state().watches))
      .toBe(before + 1);
    await expect(page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
    const prompt = "Reply after observation overflow";
    const response = await fetch(`${baseUrl}/v1/sessions/${sessionId}/follow-up`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    expect(response.ok).toBe(true);
    await expect(page.getByText(prompt, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(
      page.getByText(`Fake Agent: follow-up "${prompt}"`, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, "overflowAlerts"))).toEqual([]);
  } finally {
    await page.evaluate(() => Reflect.get(window, "stopOverflowAlerts")());
  }
};
