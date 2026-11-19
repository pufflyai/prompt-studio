import type { Page } from "@playwright/test";

// Temporary PS-169 diagnostic: observe trusted input and the existing RPC without changing dispatch.
export const observePauseInput = async (page: Page) => {
  await page.evaluate(() => {
    const events: unknown[] = [];
    Reflect.set(window, "ps169PauseInput", events);
    window.addEventListener("message", (event) => {
      const message = event.data;
      const frame = [...document.querySelectorAll("iframe")].find((frame) => frame.contentWindow === event.source);
      if (message?.type === "PS169_PAUSE_INPUT") events.push({ ...message, frame: frame?.title });
      const request =
        message?.action === "RIMLESS/RPC_REQUEST" && message.callName === "call" ? message.args?.[0] : undefined;
      if (request?.method === "performance.control")
        events.push({
          type: "host-control-request",
          operation: request.params?.operation,
          installedExtensionId: request.params?.installedExtensionId,
          active: navigator.userActivation?.isActive,
          frame: frame?.title,
          at: performance.now(),
        });
      if (events.length > 200) events.shift();
    });
  });
  await page.addInitScript(() => {
    if (window === window.top) return;
    for (const name of ["pointerdown", "pointerup", "click"])
      window.addEventListener(
        name,
        (event) => {
          const button = event.target instanceof Element ? event.target.closest("button") : null;
          if (!button?.getAttribute("aria-label")?.includes("webview-host")) return;
          window.parent.postMessage(
            {
              type: "PS169_PAUSE_INPUT",
              event: name,
              label: button.getAttribute("aria-label"),
              active: navigator.userActivation?.isActive,
              trusted: event.isTrusted,
              visibility: document.visibilityState,
              at: performance.now(),
            },
            "*",
          );
        },
        true,
      );
  });
};

export const pauseInputEvidence = async (page: Page) => ({
  events: await page.evaluate(() => Reflect.get(window, "ps169PauseInput") ?? []),
  alerts: await page.frameLocator('iframe[title="Performance details"]').getByRole("alert").allTextContents(),
});
