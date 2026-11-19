import type { Page } from "@playwright/test";
import { readSnapshot } from "./packaged-performance-helpers";

// Temporary observation only: guest input stays in a local buffer and adds no bridge traffic.
export const observePauseInput = async (page: Page, installedId: string) => {
  await page.evaluate((expected) => {
    const events: unknown[] = [];
    Reflect.set(window, "ps169PauseInput", events);
    window.addEventListener("message", (event) => {
      const message = event.data;
      const request =
        message?.action === "RIMLESS/RPC_REQUEST" && message.callName === "call" ? message.args?.[0] : undefined;
      if (request?.method !== "performance.control" || request.params?.installedExtensionId !== expected) return;
      const frame = [...document.querySelectorAll("iframe")].find((frame) => frame.contentWindow === event.source);
      events.push({
        callID: message.callID,
        operation: request.params.operation,
        active: navigator.userActivation?.isActive,
        frame: frame?.title,
        at: performance.timeOrigin + performance.now(),
      });
      if (events.length > 100) events.shift();
    });
  }, installedId);
  await page.addInitScript((expected) => {
    if (!location.pathname.includes("/pstdio.performance.view.details/")) return;
    const events: unknown[] = [{ event: "listener-armed", at: performance.timeOrigin + performance.now() }];
    Reflect.set(window, "ps169GuestPauseInput", events);
    const record = (value: unknown) => {
      events.push(value);
      if (events.length > 100) events.shift();
    };
    for (const name of ["pointerdown", "pointerup", "click"])
      window.addEventListener(
        name,
        (event) => {
          const target = event.target instanceof Element ? event.target : undefined;
          const button = target?.closest("button");
          record({
            event: name,
            control: button?.getAttribute("aria-label")?.includes("webview-host") ?? false,
            target: button ? "button" : target?.tagName,
            inTargetRow: target?.closest('[data-testid="performance-cpu-row"]')?.getAttribute("data-key") === expected,
            active: navigator.userActivation?.isActive,
            trusted: event.isTrusted,
            visibility: document.visibilityState,
            at: performance.timeOrigin + performance.now(),
          });
        },
        true,
      );
    window.addEventListener("message", (event) => {
      const message = event.data;
      if (message?.callName !== "call" || !["RIMLESS/RPC_RESOLVE", "RIMLESS/RPC_REJECT"].includes(message.action))
        return;
      record({
        event: "reply",
        callID: message.callID,
        transportRejected: message.action === "RIMLESS/RPC_REJECT",
        ok: message.result?.ok,
        errorCode: message.result?.error?.code,
        activationDenied: /local user interaction/.test(message.result?.error?.message ?? ""),
        at: performance.timeOrigin + performance.now(),
      });
    });
  }, installedId);
};

export const pauseInputEvidence = async (page: Page, installedId: string) => {
  const snapshot = await readSnapshot(page).catch(() => undefined);
  const host = await page
    .evaluate(() => Reflect.get(window, "ps169PauseInput") ?? [])
    .catch(() => ({ unavailable: true }));
  const frame = page.frames().find((frame) => frame.url().includes("/pstdio.performance.view.details/"));
  const guest = frame
    ? await frame.evaluate(() => Reflect.get(window, "ps169GuestPauseInput") ?? []).catch(() => ({ unavailable: true }))
    : { missing: true };
  return { host, guest, pausedTarget: snapshot ? snapshot.pausedExtensionIds.includes(installedId) : null };
};
