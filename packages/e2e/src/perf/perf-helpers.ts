import type { Page } from "@playwright/test";

export interface PerfStats {
  min: number;
  median: number;
  p75: number;
  p95: number;
  max: number;
}

declare global {
  interface Window {
    __longTasks?: Array<{ duration: number; startTime: number }>;
  }
}

export const calculateStats = (samples: number[]): PerfStats => {
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

export const installLongTaskObserver = async (page: Page) => {
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      window.__longTasks?.push(
        ...list.getEntries().map((entry) => ({ duration: entry.duration, startTime: entry.startTime })),
      );
    }).observe({ type: "longtask", buffered: true });
  });
};

export const throttleChromiumCpu = async (page: Page) => {
  const rate = Number(process.env.CPU_THROTTLE ?? "4");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate });
};
