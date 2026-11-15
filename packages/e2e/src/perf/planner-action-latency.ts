import { strict as assert } from "node:assert";
import type { Page } from "@playwright/test";

interface ActionClock {
  action: "property" | "archive";
  rowTitle: string;
  clickAt: number;
  paintAt: number;
  readyAt: number;
  lastResponse: number;
  running: boolean;
}

declare global {
  interface Window {
    __plannerActionClock?: ActionClock;
  }
}

// Playwright's click preparation and the sample-isolation wait are outside this clock.
// ResourceTiming and animation frames share the browser's clock, including main-thread stalls.
export const armPlannerAction = (page: Page, action: ActionClock["action"], rowTitle = "") =>
  page.evaluate(
    ({ action, rowTitle }) => {
      performance.clearResourceTimings();
      const clock: ActionClock = {
        action,
        rowTitle,
        clickAt: 0,
        paintAt: 0,
        readyAt: 0,
        lastResponse: 0,
        running: true,
      };
      window.__plannerActionClock = clock;
      const click = (event: MouseEvent) => {
        if (!(event.target instanceof Element) || !event.target.closest('[role="menuitem"], [role="menuitemradio"]'))
          return;
        document.removeEventListener("click", click, true);
        clock.clickAt = performance.now();
        const frame = () => {
          if (!clock.running || window.__plannerActionClock !== clock) return;
          const cards = [...document.querySelectorAll('[data-testid="renderer-card"]')];
          const card = cards.find((card) => card.textContent?.includes(rowTitle));
          const painted =
            action === "archive"
              ? cards.length === 0
              : Boolean(
                  card && [...card.querySelectorAll("button")].some((button) => button.textContent?.includes("High")),
                );
          const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(
            (entry) =>
              entry.startTime >= clock.clickAt && entry.name.includes(".kanban.") && entry.name.endsWith("/execute"),
          );
          const saved = entries.some((entry) =>
            entry.name.includes(action === "archive" ? ".onColumnAction/" : ".onAttributeChange/"),
          );
          const refreshed = entries.some((entry) => entry.name.includes(".query/"));
          const latest = Math.max(0, ...entries.map((entry) => entry.responseEnd));
          if (painted && !clock.paintAt) clock.paintAt = performance.now();
          if (painted && saved && refreshed && latest > clock.lastResponse) {
            clock.lastResponse = latest;
            clock.readyAt = performance.now();
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      };
      document.addEventListener("click", click, true);
    },
    { action, rowTitle },
  );

export const readPlannerAction = async (page: Page) => {
  await page.waitForFunction(() => {
    const clock = window.__plannerActionClock;
    return clock && clock.clickAt > 0 && clock.readyAt >= clock.clickAt;
  });
  const result = await page.evaluate(() => {
    const clock = window.__plannerActionClock!;
    clock.running = false;
    const requests = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter(
        (entry) =>
          entry.startTime >= clock.clickAt && entry.name.includes(".kanban.") && entry.name.endsWith("/execute"),
      )
      .map((entry) => ({
        command: entry.name.split("/commands/")[1].split("/execute")[0],
        startMs: entry.startTime - clock.clickAt,
        responseMs: entry.responseEnd - clock.clickAt,
        durationMs: entry.duration,
      }));
    const saved = requests.find((entry) =>
      entry.command.endsWith(clock.action === "archive" ? ".onColumnAction" : ".onAttributeChange"),
    )!;
    return {
      paintMs: clock.paintAt - clock.clickAt,
      saveMs: saved.responseMs,
      refreshMs: Math.max(
        ...requests.filter((entry) => entry.command.endsWith(".query")).map((entry) => entry.responseMs),
      ),
      readyMs: clock.readyAt - clock.clickAt,
      requests,
    };
  });
  for (const value of [result.paintMs, result.saveMs, result.refreshMs, result.readyMs])
    assert(
      Number.isFinite(value) && value >= 0,
      "Action latency needs a click, durable response and painted reconciliation",
    );
  return result;
};
