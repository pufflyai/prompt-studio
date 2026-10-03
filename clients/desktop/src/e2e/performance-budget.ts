import { availableParallelism, cpus } from "node:os";
import { type CDPSession, expect, type Frame, type Page, test } from "@playwright/test";

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

// Measures each renderer while `during` runs and records the result with the
// environment, so baselines can be compared across runners.
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
  const measurements = Object.fromEntries(
    entries.map(([name], index) => {
      const scriptSeconds = (after[index]?.ScriptDuration ?? 0) - (before[index]?.ScriptDuration ?? 0);
      const taskSeconds = (after[index]?.TaskDuration ?? 0) - (before[index]?.TaskDuration ?? 0);
      return [name, { scriptShare: scriptSeconds / elapsedSeconds, taskShare: taskSeconds / elapsedSeconds }];
    }),
  );
  await test.info().attach(`${label}.json`, {
    contentType: "application/json",
    body: JSON.stringify(
      {
        label,
        elapsedSeconds,
        measurements,
        environment: {
          platform: process.platform,
          arch: process.arch,
          cpu: cpus()[0]?.model,
          parallelism: availableParallelism(),
          ci: Boolean(process.env.CI),
        },
      },
      null,
      2,
    ),
  });
  return measurements;
};

export const expectWithinBudget = (measured: RendererBudget, budget: RendererBudget) => {
  expect(measured.scriptShare).toBeLessThanOrEqual(budget.scriptShare);
  expect(measured.taskShare).toBeLessThanOrEqual(budget.taskShare);
};
