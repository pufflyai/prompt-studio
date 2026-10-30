import type { Page } from "@playwright/test";
import { type BenchmarkMeasurement, recordMeasurement } from "./writer";

// Collect first so every browser benchmark reports retained heap, not allocation timing.
export const measurePageHeap = async (page: Page) => {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("HeapProfiler.collectGarbage");
    await session.send("Performance.enable");
    const { metrics } = await session.send("Performance.getMetrics");
    return metrics.find((entry) => entry.name === "JSHeapUsedSize")?.value;
  } finally {
    await session.detach();
  }
};

export const recordPageMemory = async (page: Page, measurement: Pick<BenchmarkMeasurement, "metric" | "label">) => {
  const heap = await measurePageHeap(page);
  if (heap !== undefined) recordMeasurement({ ...measurement, unit: "bytes", value: heap });
};

// Keep this session until the page closes or the caller detaches it after the workload.
export const throttleChromiumCpu = async (page: Page) => {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_THROTTLE ?? "4") });
  return session;
};
