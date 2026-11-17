import { strict as assert } from "node:assert";
import { expect } from "@playwright/test";
import { desktopBudgets } from "pstdio-benchmarks";
import { runScenario } from "pstdio-benchmarks/writer";
import { desktopWorkload, input } from "./desktop-lifecycle";
import { projectActions, request, wait, workbench } from "./desktop-project";
import { ownedProcesses } from "./owned-processes";

await runScenario("B8", (capture) =>
  desktopWorkload(capture, async (context) => {
    const seeded = await context.seed();
    const lifecycle = seeded.browser
      .contexts()[0]!
      .pages()
      .find((page) => !page.url().startsWith(seeded.runtime.origin));
    assert(lifecycle, "Missing lifecycle window");
    const feedback = lifecycle.getByRole("heading", { name: "Opening Prompt Studio", exact: true });
    const started = Date.now();
    process.kill(seeded.runtime.pid, process.platform === "win32" ? undefined : "SIGKILL");
    await feedback.waitFor({ state: "visible" });
    capture.record("feedback", Date.now() - started, desktopBudgets().recoveryMs);
    await wait(
      async () => {
        const runtime = context.runtime();
        if (!runtime || runtime.instanceId === seeded.runtime.instanceId) return false;
        try {
          await request(runtime, "/environment");
          return true;
        } catch {
          return false;
        }
      },
      "replacement authenticated runtime",
      context.signal,
    );
    const runtime = context.runtime()!;
    const page = await workbench(seeded.browser, runtime, context.signal);
    const actions = projectActions(runtime, page, seeded.fixture);
    await actions.verify();
    capture.record("usable", Date.now() - started);
    await actions.conversation();
    capture.record("first-action", await input(page));
    const conversation = await request(runtime, `/sessions/${seeded.fixture.session.id}/conversation`);
    assert.deepEqual(conversation.messages, seeded.fixture.expectedMessages);
    await expect(page.getByRole("textbox", { name: "Terminal input" })).toBeVisible();
    capture.record("processes", (await ownedProcesses([context.desktopPid(), runtime.pid])).length);
    assert.throws(() => process.kill(seeded.runtime.pid, 0), { code: "ESRCH" }, "The crashed runtime remained alive");
  }),
);
