import { type CDPSession, type Frame, type Page, test } from "@playwright/test";

// CDP script and task time are proxies for renderer CPU. They count main-thread
// work in one renderer process, not OS CPU, GPU, or paint cost. Budgets are the
// share of the measured wall time a renderer may spend busy; see the testing guide.
export const IDLE_WINDOW_MS = 10_000;
export const SETTLE_MS = 2_000;

export interface RendererBudget {
  scriptShare: number;
  taskShare: number;
}

const readMetrics = async (session: CDPSession) => {
  const { metrics } = await session.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]));
};

export const openRendererSession = async (page: Page, target: Page | Frame = page) => {
  const session = await page.context().newCDPSession(target);
  await session.send("Performance.enable");
  return session;
};

// Measures each renderer while `during` runs and attaches the raw counter deltas.
export const measureRenderers = async (
  label: string,
  renderers: Record<string, CDPSession>,
  during: () => Promise<void>,
) => {
  const entries = Object.entries(renderers);
  const before = await Promise.all(entries.map(([, session]) => readMetrics(session)));
  const startedAt = performance.now();
  await during();
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  const after = await Promise.all(entries.map(([, session]) => readMetrics(session)));
  const counters = Object.fromEntries(
    entries.map(([name], index) => [
      name,
      {
        scriptSeconds: (after[index]?.ScriptDuration ?? Number.NaN) - (before[index]?.ScriptDuration ?? Number.NaN),
        taskSeconds: (after[index]?.TaskDuration ?? Number.NaN) - (before[index]?.TaskDuration ?? Number.NaN),
      },
    ]),
  );
  await test.info().attach(`${label}-counters.json`, {
    contentType: "application/json",
    body: JSON.stringify({ label, elapsedSeconds, counters }, null, 2),
  });
  return Object.fromEntries(
    Object.entries(counters).map(([name, { scriptSeconds, taskSeconds }]) => [
      name,
      { scriptShare: scriptSeconds / elapsedSeconds, taskShare: taskSeconds / elapsedSeconds },
    ]),
  );
};

export const rendererMetrics = (measured: Record<string, RendererBudget>, budget: RendererBudget) =>
  Object.entries(measured).flatMap(([renderer, shares]) => [
    { name: `${renderer}-script`, unit: "share" as const, value: shares.scriptShare, budget: budget.scriptShare },
    { name: `${renderer}-task`, unit: "share" as const, value: shares.taskShare, budget: budget.taskShare },
  ]);
