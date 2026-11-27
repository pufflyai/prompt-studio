import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isRuntimePidAlive, readRuntimeDescriptor, requestRuntimeShutdown } from "pstdio/runtime";
import { runScenario } from "pstdio-benchmarks/writer";
import { desktopWorkload, input } from "./desktop-lifecycle";
import { projectActions, wait } from "./desktop-project";

// One desktop-runtime.log per spawn. Read the runtime's own monotonic measurement
// independently of renderer restoration and the time it takes to inspect the log.
const extensionsReadyMs = (home: string, instanceId: string): number | undefined => {
  const lines = readFileSync(join(home, "desktop-runtime.log"), "utf8").split("\n").slice(0, -1);
  const events = lines
    .filter(
      (line) => line.startsWith("{") && (line.includes('"runtime_ready"') || line.includes('"runtime.startup.phase"')),
    )
    .map((line) => JSON.parse(line));
  const owner = events.find((entry) => entry.type === "runtime_ready");
  assert.equal(owner?.instanceId, instanceId, "Startup log belongs to a different runtime");
  const phase = events.find((entry) => entry.event === "runtime.startup.phase" && entry.phase === "extensions_ready");
  if (!phase) return undefined;
  assert(Number.isFinite(phase.elapsedMs) && phase.elapsedMs > 0, "Invalid extensions_ready timestamp");
  return phase.elapsedMs;
};

await runScenario("B2", (capture) =>
  desktopWorkload(capture, async (context) => {
    const seeded = await context.seed();
    // A killed sidecar exercises crash recovery. Give the seed runtime time to checkpoint.
    const descriptor = readRuntimeDescriptor(join(context.home, "runtime.json"));
    assert(descriptor && descriptor.instanceId === seeded.runtime.instanceId, "Missing seed runtime");
    const shutdown = await requestRuntimeShutdown(descriptor, true, fetch, context.signal);
    assert.equal(shutdown.state, "accepted");
    // The desktop quits in response to the runtime's intentional shutdown. Both
    // exits must finish before closeApp releases the browser and process handles.
    await wait(
      async () => seeded.desktopExited() && !isRuntimePidAlive(descriptor.pid),
      "clean seed desktop and runtime exit",
      context.signal,
    );
    await context.closeApp();
    const app = await context.launch();
    assert.notEqual(app.runtime.instanceId, seeded.runtime.instanceId);
    try {
      const actions = projectActions(app.runtime, app.page, seeded.fixture);
      await actions.verify();
      capture.record("usable", Date.now() - app.startedAt);
      await actions.conversation();
      capture.record("first-interaction", await input(app.page));
    } finally {
      await wait(
        async () => {
          const elapsed = extensionsReadyMs(context.home, app.runtime.instanceId);
          if (elapsed === undefined) return false;
          capture.record("extensions-ready", elapsed);
          return true;
        },
        "extensions_ready in the restored runtime",
        context.signal,
      );
    }
  }),
);
