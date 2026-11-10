import { appendFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { Page } from "@playwright/test";
import { createDiagnosticEmitter } from "./native-diagnostic-emitter";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

// Diagnostic branch only. Observe the existing case without extending its work or deadline.
export const observeCanvas = async (page: Page, began: number, root: string) => {
  const evidence = join(import.meta.dirname, "../../test-results/packaged-canvas-observation");
  const path = join(evidence, `${basename(root)}.jsonl`);
  let open = true;
  const emit = createDiagnosticEmitter((entry) => appendFileSync(path, `${JSON.stringify(entry)}\n`));
  const setup = createDiagnosticEmitter(() => mkdirSync(evidence, { recursive: true }));
  setup(() => null);
  const record = (event: string, value: unknown | (() => unknown)) => {
    if (open)
      emit(() => ({
        elapsedMs: performance.now() - began,
        event,
        value: typeof value === "function" ? value() : value,
      }));
  };
  const address = (url: string) => {
    try {
      const value = new URL(url);
      return value.protocol === "http:" || value.protocol === "https:" ? value.origin + value.pathname : value.protocol;
    } catch {
      return url.slice(0, 100);
    }
  };
  page.on("pageerror", (error) => record("pageerror", String(error)));
  page.on("console", (message) => record("console", { type: message.type(), text: message.text().slice(0, 1000) }));
  page.on("request", (request) => record("request", { method: request.method(), url: address(request.url()) }));
  page.on("requestfailed", (request) =>
    record("requestfailed", { url: address(request.url()), error: request.failure() }),
  );
  page.on("response", (response) => {
    record("response", { status: response.status(), url: address(response.url()) });
    if (response.url().includes("/extensions/commands/") && response.url().includes("/execute")) {
      void response
        .json()
        .then(
          (body) =>
            record("command.outcome", {
              url: address(response.url()),
              ok: body.outcome?.ok,
              error: body.outcome?.error,
              keys: Object.keys(body.outcome?.value ?? {}),
            }),
          (error) => record("command.read.error", String(error)),
        )
        .catch((error) => record("command.observer.error", String(error)));
    }
  });
  page.on("frameattached", (frame) => record("frameattached", { name: frame.name(), url: address(frame.url()) }));
  page.on("framedetached", (frame) => record("framedetached", { name: frame.name(), url: address(frame.url()) }));
  page.on("framenavigated", (frame) => record("framenavigated", { name: frame.name(), url: address(frame.url()) }));
  try {
    await page.exposeBinding("canvasObservation", (source, value) =>
      record("window.message", { frame: source.frame.name(), value }),
    );
    await page.addInitScript(() => {
      window.addEventListener("message", (event) => {
        const data = event.data;
        if (!data || typeof data !== "object") return;
        const observe = (window as typeof window & { canvasObservation(value: unknown): Promise<void> })
          .canvasObservation;
        const scalar = (value: unknown) =>
          typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined;
        void observe({
          protocol: scalar(data.protocol),
          type: scalar(data.type),
          method: scalar(data.method),
          event: scalar(data.event),
          hidden: document.hidden,
        }).catch(() => {});
      });
    });
  } catch (error) {
    record("observer.setup.error", String(error));
    open = false;
    return () => {
      open = false;
    };
  }
  let sampling = false;
  let expected = performance.now() + 2000;
  const interval = setInterval(() => {
    const now = performance.now();
    record("host.usage", () => ({
      lagMs: now - expected,
      usage: process.resourceUsage(),
      memory: process.memoryUsage(),
    }));
    expected = now + 2000;
    if (sampling) return;
    sampling = true;
    void Promise.all(
      page.frames().map(async (frame) => {
        try {
          const state = await frame.evaluate(() => ({
            hidden: document.hidden,
            ready: document.readyState,
            path: location.pathname,
            text: document.body?.innerText.slice(0, 2000),
            frames: Array.from(document.querySelectorAll("iframe")).map((element) => ({
              title: element.title,
              visible: element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
              ready: element.dataset.frameReady,
              timings: element.dataset.frameTimings,
            })),
            startup: Array.from(document.querySelectorAll("[data-frame-startup]")).map((element) =>
              element.getAttribute("data-frame-startup"),
            ),
          }));
          record("frame.state", { name: frame.name(), url: address(frame.url()), state });
        } catch (error) {
          record("frame.state.error", String(error));
        }
      }),
    )
      .finally(() => {
        sampling = false;
      })
      .catch((error) => record("sampling.observer.error", String(error)));
  }, 2000);
  interval.unref();
  const stop = () => {
    clearInterval(interval);
    open = false;
  };
  const deadline = setTimeout(stop, Math.max(0, PACKAGED_TEST_TIMEOUT - (performance.now() - began)));
  deadline.unref();
  return () => {
    clearTimeout(deadline);
    stop();
  };
};
