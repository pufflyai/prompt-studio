import { strict as assert } from "node:assert";
import { runScenario } from "pstdio-benchmarks/writer";
import { desktopWorkload, input } from "./desktop-lifecycle";
import { projectActions } from "./desktop-project";

await runScenario("B3", (capture) =>
  desktopWorkload(capture, async (context) => {
    const seeded = await context.seed();
    await context.closeApp();
    const owned = await context.startWarmRuntime();
    const app = await context.launch();
    assert.equal(app.runtime.instanceId, owned.instanceId, "Warm launch replaced the owned runtime");
    assert.equal(app.runtime.pid, owned.pid);
    capture.record("attachment", Date.now() - app.startedAt);
    await projectActions(app.runtime, app.page, seeded.fixture).verify();
    capture.record("usable", Date.now() - app.startedAt);
    await projectActions(app.runtime, app.page, seeded.fixture).conversation();
    capture.record("first-interaction", await input(app.page));
  }),
);
