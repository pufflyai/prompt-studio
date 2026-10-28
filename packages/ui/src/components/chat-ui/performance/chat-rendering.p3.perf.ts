import { expect, test } from "@playwright/test";
import { recordMeasurement } from "pstdio-benchmarks/writer";
import { openPerformancePreview } from "./canvas-preview";

const workloads = ["Rich turns", "Plain turns", "1000 responses", "5000 responses", "Large response"];

for (const workload of workloads) {
  test(`measures ${workload.toLowerCase()} rendering`, async ({ page }, testInfo) => {
    const browserSession = await page.context().newCDPSession(page);
    await browserSession.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_THROTTLE ?? "4") });
    await page.addInitScript(() => {
      window.__longTasks = [];
      new PerformanceObserver((list) => {
        window.__longTasks?.push(...list.getEntries().map((entry) => ({ duration: entry.duration })));
      }).observe({ type: "longtask", buffered: true });
    });
    const preview = await openPerformancePreview(page, "patterns-chat-chat-panel-rendering--rendering-workloads");
    const cdp = browserSession;
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_THROTTLE ?? "4") });
    await cdp.send("Performance.enable");
    await preview.getByRole("button", { name: workload, exact: true }).waitFor();
    await preview.evaluate(() => document.fonts.ready);
    const samples = [];
    for (const phase of ["mount", "middle", "switch", "stream"]) {
      if (phase === "stream" && workload === "Large response") continue;
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.start");
      const before = await cdp.send("Performance.getMetrics");
      const startedAt = await preview.evaluate(
        ({ phase, workload }) => {
          window.__longTasks = [];
          const startedAt = performance.now();
          if (phase === "middle") {
            const viewport = document.querySelector(
              '[data-testid="rendering-chat"] [data-scope="scroll-area"][data-part="viewport"]',
            )!;
            viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, bubbles: true }));
            viewport.scrollTop = viewport.scrollHeight / 2;
          } else {
            let name = workload;
            if (phase === "switch") name = "Switch session";
            if (phase === "stream") name = "Stream response";
            Array.from(document.querySelectorAll("button"))
              .find((button) => button.textContent === name)!
              .click();
          }
          return startedAt;
        },
        { phase, workload },
      );
      if (phase === "stream")
        await preview.waitForFunction(() => performance.getEntriesByName("chat-rendering:stream-complete").length > 0);
      await preview.waitForFunction(() => {
        const viewport = document.querySelector(
          '[data-testid="rendering-chat"] [data-scope="scroll-area"][data-part="viewport"]',
        );
        return (
          viewport &&
          getComputedStyle(viewport).visibility === "visible" &&
          viewport.querySelector("[data-chat-message-list-item]")
        );
      });
      await preview.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
          ),
      );
      const snapshot = await preview.evaluate(
        (start) => ({
          elapsedMs: performance.now() - start,
          responses: document.querySelectorAll('[data-chat-message-list-item="response"]').length,
          rows: document.querySelectorAll("[data-chat-message-list-item]").length,
          editors: document.querySelectorAll("[data-lexical-editor]").length,
          tables: document.querySelectorAll("table").length,
          nodes: document.querySelectorAll("*").length,
          longTasks: window.__longTasks,
        }),
        startedAt,
      );
      const after = await cdp.send("Performance.getMetrics");
      const { profile } = await cdp.send("Profiler.stop");
      await testInfo.attach(`${phase}.cpuprofile`, { body: JSON.stringify(profile), contentType: "application/json" });
      const metrics = Object.fromEntries(
        ["ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "TaskDuration"].map((name) => [
          name,
          after.metrics.find((metric) => metric.name === name)!.value -
            before.metrics.find((metric) => metric.name === name)!.value,
        ]),
      );
      samples.push({ workload, phase, ...snapshot, ...metrics });
      const metric = `${workload.toLowerCase().replaceAll(" ", "-")}/${phase}`;
      const label = `${workload}, ${phase}`;
      recordMeasurement({ metric, label, unit: "ms", value: snapshot.elapsedMs });
      const heap = after.metrics.find((entry) => entry.name === "JSHeapUsedSize")?.value;
      if (heap !== undefined)
        recordMeasurement({ metric: `${metric}/js-heap`, label: `${label}, page heap`, unit: "bytes", value: heap });
      expect(snapshot.responses).toBeLessThan(30);
      expect(snapshot.elapsedMs).toBeGreaterThan(0);
    }
    console.info("chat-rendering", JSON.stringify(samples));
    await testInfo.attach("rendering.json", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });
  });
}
