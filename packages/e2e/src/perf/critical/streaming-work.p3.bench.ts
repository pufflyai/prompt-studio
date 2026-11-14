import { strict as assert } from "node:assert";
import { expect } from "@playwright/test";
import { runScenario } from "pstdio-benchmarks/writer";
import { afterPaint, desktopWorkload, input } from "./desktop-lifecycle";
import { projectActions, request, seedProject, wait } from "./desktop-project";
import { installStreamingClock } from "./streaming-clock";

await runScenario("B4", (capture) =>
  desktopWorkload(capture, async (context) => {
    assert(capture.scenario.id === "B4");
    const first = await context.seed();
    const second = await seedProject(
      first.runtime,
      first.page,
      context.home,
      context.signal,
      "Second populated project",
    );
    const actions = projectActions(first.runtime, first.page, first.fixture);
    await installStreamingClock(first.page);
    await first.page.reload();
    await actions.conversation();
    const cdp = await first.page.context().newCDPSession(first.page);
    await cdp.send("Performance.enable");
    const counters = async () => {
      const { metrics } = await cdp.send("Performance.getMetrics");
      const read = (name: string) => {
        const metric = metrics.find((entry) => entry.name === name);
        assert(metric, `${name} counter missing`);
        return metric.value;
      };
      return { script: read("ScriptDuration"), task: read("TaskDuration"), at: read("Timestamp") };
    };
    const measure = async (name: string, action: () => Promise<unknown>) => {
      assert.equal(
        (await request(first.runtime, `/sessions/${first.fixture.session.id}`)).status,
        "in_progress",
        `${name} missed the fixed stream`,
      );
      const start = await first.page.evaluate(() => performance.now());
      await action();
      capture.record(name, (await afterPaint(first.page)) - start);
    };
    try {
      await Bun.sleep(capture.scenario.stream.idleSettleMs);
      const idleBefore = await counters();
      await Bun.sleep(capture.scenario.stream.idleSampleMs);
      const idleAfter = await counters();
      capture.detail("idle", { idleBefore, idleAfter });
      capture.record("idle-script", (idleAfter.script - idleBefore.script) / (idleAfter.at - idleBefore.at));
      capture.record("idle-task", (idleAfter.task - idleBefore.task) / (idleAfter.at - idleBefore.at));
      await first.page.evaluate(() => {
        const clock = window.criticalStream;
        clock.visible = true;
        clock.frames = [];
        clock.tasks = [];
        clock.paints = [];
        clock.received = 0;
      });
      const before = await counters();
      const started = performance.now();
      await request(first.runtime, `/sessions/${first.fixture.session.id}/follow-up`, {
        prompt: "Replay __fake_long_stream__",
      });
      await expect(first.page.getByText(/^Step 1\./).filter({ visible: true })).toBeVisible();
      assert.equal(
        (await request(first.runtime, `/sessions/${first.fixture.session.id}`)).status,
        "in_progress",
        "Input missed the fixed stream",
      );
      capture.record("input", await input(first.page));
      await measure("history", async () => {
        await first.page.evaluate(() => {
          window.criticalStream.visible = false;
        });
        const history = first.page.getByRole("log").locator(':scope > [data-part="root"] > [data-part="viewport"]');
        await history.evaluate((element) => {
          element.scrollTop = 0;
        });
        await expect(
          first.page.getByText(`Message 1: ${"Read the workspace and explain the change. ".repeat(20)}`, {
            exact: true,
          }),
        ).toBeVisible();
      });
      await measure("file", () => actions.file());
      await measure("terminal", () => actions.terminal());
      await measure("panel", async () => {
        await first.page.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
        await first.page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
        await expect(first.page.getByRole("textbox", { name: "Terminal input" })).toBeVisible();
      });
      await measure("project-switch", async () => {
        await projectActions(first.runtime, first.page, second).conversation();
        await expect(first.page.getByRole("tab", { name: second.project.name, exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await actions.conversation();
        await expect(first.page.getByRole("tab", { name: first.fixture.project.name, exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await first.page.evaluate(() => {
          window.criticalStream.visible = true;
        });
      });
      const latest = first.page.getByRole("button", { name: "Scroll to latest message", exact: true });
      if (await latest.isVisible()) await latest.click();
      await wait(
        async () => (await request(first.runtime, `/sessions/${first.fixture.session.id}`)).status === "completed",
        "fixed replay completion",
        context.signal,
      );
      await expect(first.page.getByText(/^Step 30\./).filter({ visible: true })).toBeVisible();
      await afterPaint(first.page);
      capture.record("completion", performance.now() - started);
      const after = await counters();
      const clock = await first.page.evaluate(() => window.criticalStream);
      capture.detail("foreground-stream", { clock, before, after });
      assert(
        clock.received >= 240 && clock.paints.length > 0 && clock.frames.length > 0,
        "Incomplete streaming/paint observations",
      );
      capture.record("stream-to-paint", Math.max(...clock.paints.map((entry) => entry.painted - entry.received)));
      capture.record("longest-stall", Math.max(...clock.frames, ...clock.tasks));
      capture.record("script", (after.script - before.script) / (after.at - before.at));
      capture.record("task", (after.task - before.task) / (after.at - before.at));
      const conversation = await request(first.runtime, `/sessions/${first.fixture.session.id}/conversation`);
      assert.equal(conversation.messages.length, 131);
      assert.equal(
        conversation.messages
          .slice(101)
          .filter((message: { parts: { type: string }[] }) => message.parts.some((part) => part.type === "tool"))
          .length,
        30,
      );
      await request(first.runtime, `/sessions/${first.fixture.session.id}/follow-up`, {
        prompt: "Replay __fake_long_stream__",
      });
      await wait(
        async () => (await request(first.runtime, `/sessions/${first.fixture.session.id}`)).status === "in_progress",
        "second replay running",
        context.signal,
      );
      const cancelling = performance.now();
      await request(first.runtime, `/sessions/${first.fixture.session.id}/stop`, {});
      await wait(
        async () => (await request(first.runtime, `/sessions/${first.fixture.session.id}`)).status === "cancelled",
        "cancelled replay",
        context.signal,
      );
      const cancelled = await request(first.runtime, `/sessions/${first.fixture.session.id}/conversation`);
      assert(cancelled.messages.length < 162, "Cancellation allowed the complete second replay");
      await expect(
        first.page.locator('[data-testid="content-editable"][contenteditable="true"]:visible'),
      ).toBeEditable();
      capture.record("cancellation", performance.now() - cancelling);
      capture.detail("cancelled-conversation", cancelled);
    } finally {
      await cdp.detach();
    }
  }),
);
