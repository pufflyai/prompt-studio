import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import type { CDPSession, Locator, Page, Request } from "@playwright/test";

declare global {
  interface Window {
    __plannerStress: {
      start: number;
      painted?: number;
      longTasks: Array<{ duration: number; startTime: number }>;
      frames: number[];
    };
  }
}

export const installPlannerClock = (page: Page) =>
  page.addInitScript(() => {
    window.__plannerStress = { start: 0, longTasks: [], frames: [] };
    new PerformanceObserver((list) => {
      window.__plannerStress.longTasks.push(
        ...list.getEntries().map(({ duration, startTime }) => ({ duration, startTime })),
      );
    }).observe({ type: "longtask", buffered: true });
  });

export interface CommandSample {
  command: string;
  ms: number;
  bytes: number;
  status: number;
}

export const recordPlannerRequests = (page: Page) => {
  const commands: CommandSample[] = [];
  const active = new Map<Request, number>();
  const pending = new Set<Promise<void>>();
  const isViewList = (request: Request) => /\/boards\/[^/]+\/views$/.test(request.url());
  page.on("request", (request) => {
    if (
      (request.url().includes("/extensions/commands/") && request.url().endsWith("/execute")) ||
      isViewList(request)
    ) {
      active.set(request, performance.now());
    }
  });
  const finished = (request: Request) => {
    const started = active.get(request);
    if (started === undefined) return;
    const ms = performance.now() - started;
    active.delete(request);
    const collecting = (async () => {
      const response = await request.response();
      const body = response ? await response.body().catch(() => Buffer.alloc(0)) : Buffer.alloc(0);
      commands.push({
        command: isViewList(request)
          ? "board-views.list"
          : decodeURIComponent(request.url().split("/commands/")[1].split("/execute")[0]),
        ms,
        bytes: body.length,
        status: response?.status() ?? 0,
      });
    })();
    pending.add(collecting);
    void collecting.finally(() => pending.delete(collecting));
  };
  page.on("requestfinished", finished);
  page.on("requestfailed", finished);
  return {
    commands,
    reset: () => {
      commands.length = 0;
    },
    async settle() {
      // This wait isolates samples; it is excluded from the page's drop-to-paint clock.
      do {
        await page.waitForTimeout(250);
      } while (active.size || pending.size);
    },
  };
};

export const measurePlannerDrop = async (input: {
  page: Page;
  cdp: CDPSession;
  source: Locator;
  target: Locator;
  title: string;
  columnId: string;
  beforeTitle?: string;
  profilePath: string;
  settle: () => Promise<void>;
}) => {
  const { page, cdp, source, target, title, columnId, beforeTitle, profilePath } = input;
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(
    ({ title, columnId, beforeTitle }) => {
      performance.clearResourceTimings();
      window.__plannerStress = { start: 0, longTasks: [], frames: [] };
      document.addEventListener(
        "drop",
        () => {
          const clock = window.__plannerStress;
          clock.start = performance.now();
          let last = clock.start;
          const frame = () => {
            const now = performance.now();
            clock.frames.push(now - last);
            last = now;
            const cards = [
              ...document.querySelectorAll(`[data-testid="board-column-${columnId}"] [data-testid="renderer-card"]`),
            ];
            const movingIndex = cards.findIndex((card) => card.textContent?.includes(title));
            const beforeIndex = cards.findIndex((card) => card.textContent?.includes(beforeTitle ?? ""));
            if (movingIndex >= 0 && (!beforeTitle || movingIndex + 1 === beforeIndex)) {
              clock.painted = now;
              return;
            }
            requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        },
        { capture: true, once: true },
      );
    },
    { title, columnId, beforeTitle },
  );
  await cdp.send("Profiler.start");
  try {
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await source.dispatchEvent("dragstart", { dataTransfer });
    await target.dispatchEvent("dragover", { dataTransfer });
    await target.dispatchEvent("drop", { dataTransfer });
    await source.dispatchEvent("dragend", { dataTransfer });
    await dataTransfer.dispose();
    await page.waitForFunction(() => window.__plannerStress.painted !== undefined);
    await input.settle();
    const result = await page.evaluate(() => {
      const clock = window.__plannerStress;
      return {
        paintMs: clock.painted! - clock.start,
        persistenceMs: Math.max(
          0,
          ...performance
            .getEntriesByType("resource")
            .filter((entry) => /kanban\.(onMove|onAttributeChange|onReorder)\/execute/.test(entry.name))
            .map((entry) => (entry as PerformanceResourceTiming).responseEnd - clock.start),
        ),
        refreshMs: Math.max(
          0,
          ...performance
            .getEntriesByType("resource")
            .filter((entry) => /kanban\.query\/execute/.test(entry.name))
            .map((entry) => (entry as PerformanceResourceTiming).responseEnd - clock.start),
        ),
        longTasks: clock.longTasks.filter(({ startTime }) => startTime >= clock.start).map(({ duration }) => duration),
        maxFrameMs: Math.max(...clock.frames),
      };
    });
    assert(result.paintMs >= 0);
    return result;
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      clock: window.__plannerStress,
      columns: [...document.querySelectorAll('[data-testid^="board-column-"]')].map((column) => ({
        id: column.getAttribute("data-testid"),
        cards: [...column.querySelectorAll('[data-testid="renderer-card"]')].map((card) => card.textContent),
      })),
    }));
    await writeFile(
      profilePath.replace(".cpuprofile", ".failure.json"),
      JSON.stringify({ title, columnId, beforeTitle, error: String(error), ...diagnostic }, null, 2),
    );
    await page.screenshot({ path: profilePath.replace(".cpuprofile", ".failure.png") });
    throw error;
  } finally {
    const { profile } = await cdp.send("Profiler.stop");
    await writeFile(profilePath, JSON.stringify(profile));
  }
};
