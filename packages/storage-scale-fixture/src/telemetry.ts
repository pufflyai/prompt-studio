import { monitorEventLoopDelay } from "node:perf_hooks";

// Process counters supplement phase timings; null metrics must never be presented as zero work.
export const measure = async <T>(action: () => Promise<T>) => {
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const before = process.cpuUsage();
  const start = performance.now();
  try {
    const value = await action();
    const durationMs = performance.now() - start;
    // Let the monitor observe a synchronous blocked phase before reading it.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const cpu = process.cpuUsage(before);
    loop.disable();
    return {
      value,
      durationMs,
      cpuMs: { user: cpu.user / 1_000, system: cpu.system / 1_000 },
      eventLoop: { maxMs: loop.max / 1e6, meanMs: Number.isNaN(loop.mean) ? null : loop.mean / 1e6 },
      memory: process.memoryUsage(),
      maxRssBytes: process.resourceUsage().maxRSS * 1_024,
    };
  } finally {
    loop.disable();
  }
};
