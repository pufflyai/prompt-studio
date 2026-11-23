import { expect, test } from "bun:test";
import { createProjectWork } from "../../../services/project-work";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { createDeviceAutomationFixture } from "../device-automations.fixture";
import { executeScheduledCommand } from "./execution";

test("project removal cancels a scheduled command and drains its process cleanup", async () => {
  const fixture = await createDeviceAutomationFixture();
  const { deps } = await fixture.device();
  const work = createProjectWork();
  deps.projectService.work = work;
  const entered = Promise.withResolvers<AbortSignal>();
  const finish = Promise.withResolvers<void>();
  const stop = Promise.withResolvers<void>();
  (globalThis as Record<string, unknown>).__deviceAutomationRun = async (_metadata: unknown, signal: AbortSignal) => {
    entered.resolve(signal);
    try {
      await Promise.race([
        stop.promise,
        new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        }),
      ]);
    } finally {
      await finish.promise;
    }
  };
  const snapshot = await deps.extensionRuntimeCatalog.get(fixture.projectId);
  const input = {
    deps,
    snapshot,
    schedule: snapshot.runtime.schedules[0]!,
    ctx: { runId: "removal", reason: "live" as const, scheduledFor: new Date() },
    dispatch: (execute: () => Promise<boolean>) => execute(),
  };
  const running = executeScheduledCommand(input).catch((error) => error);
  let drained = false;
  try {
    const signal = await entered.promise;
    work.freeze(fixture.projectId);
    const drain = work.drain(fixture.projectId).then(() => {
      drained = true;
    });
    await Bun.sleep(0);
    expect(drained).toBe(false);
    expect(signal.aborted).toBe(true);
    await expectRejection(executeScheduledCommand(input)).toThrow("removing its copy");
    finish.resolve();
    await running;
    await drain;
    expect(drained).toBe(true);
  } finally {
    finish.resolve();
    stop.resolve();
    await running;
    work.release(fixture.projectId);
    await fixture.close();
  }
});
