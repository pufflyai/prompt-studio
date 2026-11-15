import { runScenario } from "pstdio-benchmarks/writer";
import { desktopWorkload, input } from "./desktop-lifecycle";
import { projectActions } from "./desktop-project";

await runScenario("B2", (capture) =>
  desktopWorkload(capture, async (context) => {
    const seeded = await context.seed();
    await context.closeApp();
    const app = await context.launch();
    await projectActions(app.runtime, app.page, seeded.fixture).verify();
    capture.record("usable", Date.now() - app.startedAt);
    await projectActions(app.runtime, app.page, seeded.fixture).conversation();
    capture.record("first-interaction", await input(app.page));
  }),
);
