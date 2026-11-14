import { strict as assert } from "node:assert";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { desktopBudgets } from "pstdio-benchmarks";
import { runScenario } from "pstdio-benchmarks/writer";
import { afterPaint, desktopWorkload } from "./desktop-lifecycle";
import { request, selectProject } from "./desktop-project";

await runScenario("B1", (capture) =>
  desktopWorkload(capture, async (context) => {
    const app = await context.launch();
    const lifecycle = app.browser
      .contexts()[0]!
      .pages()
      .find((page) => !page.url().startsWith(app.runtime.origin));
    assert(lifecycle, "Startup window missing");
    const painted = await lifecycle.evaluate(() => {
      const paint = performance.getEntriesByName("first-contentful-paint")[0];
      if (!paint) throw new Error("Startup window did not report its first paint");
      return performance.timeOrigin + paint.startTime;
    });
    const budgets = desktopBudgets();
    capture.record("window", painted - app.startedAt, budgets.startupWindowMs);
    capture.record("shell", Date.now() - app.startedAt, budgets.coldStartMs);
    const projects = await request(app.runtime, "/projects");
    assert.equal(projects.length, 0, "First launch must begin with an empty home");
    const folder = join(context.home, "first-project");
    mkdirSync(folder);
    const project = await request(app.runtime, "/projects", {
      name: "First project",
      initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
    });
    assert.equal(project.extension_warnings?.length ?? 0, 0, "Default tools failed to initialize");
    capture.detail(
      "boundary",
      "Empty-home launch through authenticated API, first-project default-tool initialization, selected Home content and completed first native interaction; no prewarm. The unchanged 2s product limit applies on the actual 10-core/32GiB M5 reference host.",
    );
    const before = await app.page.evaluate(() => performance.now());
    await selectProject(app.page, project.name);
    await expect(app.page.frameLocator('iframe[title="Home"]').getByTestId("start-page")).toBeVisible();
    capture.record("first-interaction", (await afterPaint(app.page)) - before);
    capture.record("usable", Date.now() - app.startedAt);
  }),
);
