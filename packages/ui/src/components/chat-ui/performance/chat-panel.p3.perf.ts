import { expect, type Frame, type Page, test } from "@playwright/test";
import { type BenchmarkMeasurement, recordMeasurement } from "pstdio-benchmarks/writer";
import { openPerformancePreview } from "./canvas-preview";
import type { ChatMountMetric } from "./chat-mount-metrics";

type PerfStats = {
  min: number;
  median: number;
  p75: number;
  p95: number;
  max: number;
};

type ProfilerSample = {
  scenario: string;
  phase: string;
  actualDuration: number;
  baseDuration: number;
  commitTime: number;
};

declare global {
  interface Window {
    __chatPanelPerf?: ProfilerSample[];
    __chatPanelMountMetrics?: ChatMountMetric[];
    __longTasks?: Array<{ duration: number }>;
  }
}

const VARIANT_IDS = {
  largeConversation: "patterns-chat-chat-panel-performance--large-conversation",
  sessionSwitching: "patterns-chat-chat-panel-performance--session-switching",
  streamingScenario: "patterns-chat-chat-panel-performance--streaming-scenario",
} as const;

const BUDGETS = {
  largeConversationReadyMs: Number(process.env.UI_PERF_LARGE_CONVERSATION_READY_MS ?? "20000"),
  sessionSwitchMs: Number(process.env.UI_PERF_SESSION_SWITCH_MS ?? "10000"),
  streamingCompleteMs: Number(process.env.UI_PERF_STREAMING_COMPLETE_MS ?? "30000"),
  totalLongTaskMs: Number(process.env.UI_PERF_TOTAL_LONG_TASK_MS ?? "20000"),
};
const shouldAssertBudgets = process.env.UI_PERF_ASSERT_BUDGETS === "1";

// Records the scenario time and the heap the page keeps afterwards, after garbage collection.
const recordScenario = async (page: Frame, timing: Omit<BenchmarkMeasurement, "unit">) => {
  recordMeasurement({ ...timing, unit: "ms" });
  const session = await page.page().context().newCDPSession(page.page());
  await session.send("HeapProfiler.collectGarbage");
  await session.send("Performance.enable");
  const { metrics } = await session.send("Performance.getMetrics");
  await session.detach();
  const heap = metrics.find((entry) => entry.name === "JSHeapUsedSize")?.value;
  if (heap !== undefined)
    recordMeasurement({
      metric: `${timing.metric}/js-heap`,
      label: `${timing.label}, page heap`,
      unit: "bytes",
      value: heap,
    });
};

const calculateStats = (samples: number[]): PerfStats => {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (value: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] ?? 0;

  return {
    min: sorted[0] ?? 0,
    median: percentile(0.5),
    p75: percentile(0.75),
    p95: percentile(0.95),
    max: sorted.at(-1) ?? 0,
  };
};

const installLongTaskObserver = async (page: Page) => {
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      window.__longTasks?.push(...list.getEntries().map((entry) => ({ duration: entry.duration })));
    }).observe({ type: "longtask", buffered: true });
  });
};

const throttleChromiumCpu = async (page: Page) => {
  const rate = Number(process.env.CPU_THROTTLE ?? "4");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate });
};

const waitForMark = async (page: Frame, markName: string, startMarkName?: string) => {
  await page.waitForFunction((name) => performance.getEntriesByName(name).length > 0, markName);
  return page.evaluate(
    ({ readyName, startName }) => {
      const ready = performance.getEntriesByName(readyName).at(-1)?.startTime ?? 0;
      if (!startName) return ready;

      const start = performance.getEntriesByName(startName).at(-1)?.startTime ?? 0;
      return ready - start;
    },
    { readyName: markName, startName: startMarkName },
  );
};

const waitForMountMetric = async (page: Frame, scenario: string, label?: string) => {
  await page.waitForFunction(
    ({ scenarioName, metricLabel }) =>
      window.__chatPanelMountMetrics?.some(
        (metric) => metric.scenario === scenarioName && (!metricLabel || metric.label === metricLabel),
      ),
    { scenarioName: scenario, metricLabel: label },
  );

  return page.evaluate(
    ({ scenarioName, metricLabel }) =>
      window.__chatPanelMountMetrics
        ?.filter((metric) => metric.scenario === scenarioName && (!metricLabel || metric.label === metricLabel))
        .at(-1) ?? null,
    { scenarioName: scenario, metricLabel: label },
  );
};

const getTotalLongTaskDuration = (page: Frame) =>
  page.evaluate(() => window.__longTasks?.reduce((total, task) => total + task.duration, 0) ?? 0);

const getProfilerStats = async (page: Frame, scenario: string) => {
  const samples = await page.evaluate(
    (scenarioName) => window.__chatPanelPerf?.filter((sample) => sample.scenario === scenarioName) ?? [],
    scenario,
  );

  return {
    commits: samples.length,
    actualDuration: calculateStats(samples.map((sample) => sample.actualDuration)),
    baseDuration: calculateStats(samples.map((sample) => sample.baseDuration)),
  };
};

const expectWithinBudget = (value: number, budget: number) => {
  if (shouldAssertBudgets) {
    expect(value).toBeLessThanOrEqual(budget);
    return;
  }

  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
};

const openPreview = async (page: Page, variantId: string) => {
  await installLongTaskObserver(page);
  await throttleChromiumCpu(page);
  return openPerformancePreview(page, variantId);
};

test.describe("chat panel performance", () => {
  const largeMountSamples: number[] = [];
  const switchSamples: number[] = [];
  const streamingSamples: number[] = [];
  const longTaskSamples: number[] = [];

  test.afterAll(() => {
    console.info("chat-large-mount", calculateStats(largeMountSamples));
    console.info("chat-session-switch", calculateStats(switchSamples));
    console.info("chat-streaming-complete", calculateStats(streamingSamples));
    console.info("chat-total-long-tasks", calculateStats(longTaskSamples));
  });

  test("loads a large conversation", async ({ page }) => {
    const preview = await openPreview(page, VARIANT_IDS.largeConversation);

    const mountMetric = await waitForMountMetric(preview, "large-conversation", "Large chat mount");
    const longTasks = await getTotalLongTaskDuration(preview);
    const profiler = await getProfilerStats(preview, "large-conversation");

    expect(mountMetric).not.toBeNull();
    largeMountSamples.push(mountMetric?.totalMs ?? 0);
    await recordScenario(preview, {
      metric: "large-conversation",
      label: "Load a large conversation",
      value: mountMetric?.totalMs ?? 0,
      budget: BUDGETS.largeConversationReadyMs,
    });
    longTaskSamples.push(longTasks);
    console.info("large-conversation-mount", mountMetric);
    console.info("large-conversation-profiler", profiler);

    expectWithinBudget(mountMetric?.totalMs ?? 0, BUDGETS.largeConversationReadyMs);
    expectWithinBudget(longTasks, BUDGETS.totalLongTaskMs);
    expect(profiler.commits).toBeGreaterThanOrEqual(0);
  });

  test("switches between large sessions", async ({ page }) => {
    const preview = await openPreview(page, VARIANT_IDS.sessionSwitching);
    await waitForMark(preview, "chat-perf:session-switch-ready");

    await preview.evaluate(() => {
      performance.clearMarks();
      window.__chatPanelMountMetrics = [];
      window.__longTasks = [];
    });
    await preview.evaluate(() => performance.mark("chat-perf:test-session-switch-click"));
    await preview.getByRole("button", { name: "Secondary" }).click();

    const switchStartDelay = await waitForMark(
      preview,
      "chat-perf:session-switch-start",
      "chat-perf:test-session-switch-click",
    );
    const switchMetric = await waitForMountMetric(preview, "session-switching", "Secondary session switch");
    const longTasks = await getTotalLongTaskDuration(preview);
    const profiler = await getProfilerStats(preview, "session-switching");

    expect(switchMetric).not.toBeNull();
    switchSamples.push(switchMetric?.totalMs ?? 0);
    await recordScenario(preview, {
      metric: "session-switch",
      label: "Switch between large sessions",
      value: switchMetric?.totalMs ?? 0,
      budget: BUDGETS.sessionSwitchMs,
    });
    longTaskSamples.push(longTasks);
    console.info("session-switching", switchMetric);
    console.info("session-switching-profiler", profiler);

    // Set on 2026-10-26 from hosted ubuntu-24.04 runs (slowest 407 ms) plus about 20%.
    expect(switchStartDelay).toBeLessThan(500);
    expectWithinBudget(switchMetric?.totalMs ?? 0, BUDGETS.sessionSwitchMs);
    expectWithinBudget(longTasks, BUDGETS.totalLongTaskMs);
    expect(await preview.getByTestId("chat-perf-message-count").textContent()).toContain("1000 messages");
  });

  test("streams incremental updates into an existing conversation", async ({ page }) => {
    const preview = await openPreview(page, VARIANT_IDS.streamingScenario);

    const streamTime = await waitForMark(preview, "chat-perf:stream-complete", "chat-perf:stream-start");
    const mountMetric = await waitForMountMetric(preview, "streaming", "Seed chat mount");
    const longTasks = await getTotalLongTaskDuration(preview);
    const profiler = await getProfilerStats(preview, "streaming");

    streamingSamples.push(streamTime);
    await recordScenario(preview, {
      metric: "streaming",
      label: "Stream into an existing conversation",
      value: streamTime,
      budget: BUDGETS.streamingCompleteMs,
    });
    longTaskSamples.push(longTasks);
    console.info("streaming-seed-mount", mountMetric);
    console.info("streaming-profiler", profiler);

    expectWithinBudget(streamTime, BUDGETS.streamingCompleteMs);
    expectWithinBudget(longTasks, BUDGETS.totalLongTaskMs);
    expect(await preview.getByTestId("chat-perf-message-count").textContent()).toContain("1000 messages");
  });
});
