import { strict as assert } from "node:assert";
import { join } from "node:path";
import { runScenario, scenarioById } from "pstdio-benchmarks/writer";
import { sampleDesktopMemory } from "../desktop-memory-samples";
import { desktopWorkload } from "./desktop-lifecycle";

await runScenario("B5", (capture) =>
  desktopWorkload(capture, async (context) => {
    const workload = scenarioById("B5");
    assert(workload.id === "B5");
    const seeded = await context.seed();
    const cdp = await seeded.page.context().newCDPSession(seeded.page);
    await cdp.send("Performance.enable");
    const sampler = sampleDesktopMemory(
      context.sidecar,
      () => [context.desktopPid(), seeded.runtime.pid],
      join(process.env.BENCHMARK_EVIDENCE_DIR ?? "test-results/production-performance", "B5-memory.jsonl"),
      async () => {
        const { metrics } = await cdp.send("Performance.getMetrics");
        const value = metrics.find((entry) => entry.name === "JSHeapUsedSize")?.value;
        assert(value !== undefined && Number.isFinite(value), "Renderer heap counter missing");
        return value;
      },
    );
    let closed = false;
    try {
      sampler.phase("settle");
      await Bun.sleep(workload.settleMs);
      sampler.phase("measure");
      const started = performance.now();
      for (let cycle = 0; cycle < workload.cycles; cycle++) {
        sampler.cycle(cycle);
        context.signal.throwIfAborted();
        await seeded.actions.conversation();
        await Bun.sleep(3_000);
        await seeded.actions.home();
        await seeded.actions.file();
        await Bun.sleep(3_000);
        await seeded.actions.home();
        await seeded.page.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
        await Bun.sleep(3_000);
        await seeded.page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
        const remaining = started + (cycle + 1) * workload.cycleMs - performance.now();
        assert(remaining > 0, `Fixed memory cycle ${cycle} overran its 15-second slot`);
        await Bun.sleep(remaining);
      }
      assert(performance.now() - started >= workload.durationMs);
      sampler.phase("after");
      await Bun.sleep(workload.sampleIntervalMs);
      const memory = await sampler.close();
      closed = true;
      capture.detail("memory", memory);
      assert.equal(memory.missingSamples, 0);
      assert.equal(memory.missingMs, 0);
      assert(memory.maximumGapMs <= 1_000, "Whole-app samples must cover at least 1 Hz");
      assert(memory.durationMs >= workload.durationMs, "Incomplete ten-minute memory window");
      assert(memory.averageBytes !== null && memory.rssPeakBytes !== null && memory.heapPeakBytes !== null);
      assert.equal(memory.cycles.length, workload.cycles);
      assert(memory.cycles.every((cycle) => cycle.retainedBytes !== null));
      const retained = memory.cycles.map((cycle) => cycle.retainedBytes!);
      capture.record("physical-average", memory.averageBytes, {
        value: 2_000_000_000,
        evidence: "003.3.1: M5 whole-app physical footprint including compression",
      });
      capture.record("physical-peak", memory.measuredPeakBytes);
      capture.record("retained-growth", Math.max(...retained) - retained[0]!);
      capture.record("rss-peak", memory.rssPeakBytes);
      capture.record("js-heap-peak", memory.heapPeakBytes);
      capture.record("processes", memory.maximumProcessCount);
      capture.record("maximum-sample-gap", memory.maximumGapMs);
    } finally {
      if (!closed) capture.detail("incomplete-memory", await sampler.close());
      await cdp.detach();
    }
  }),
);
