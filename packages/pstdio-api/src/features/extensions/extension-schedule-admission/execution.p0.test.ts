import { test } from "bun:test";
import { createProjectWork } from "../../../services/project-work";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { createDeviceAutomationFixture } from "../device-automations.fixture";
import { executeScheduledCommand } from "./execution";

// The command runs in a worker. Cancelling settles the host's call at once; the worker's own cleanup
// can no longer reach the project, so removal does not wait for it.
test("project removal cancels a running scheduled command and drains without waiting for its worker", async () => {
  const fixture = await createDeviceAutomationFixture();
  const { deps } = await fixture.device();
  const work = createProjectWork();
  deps.projectService.work = work;
  const entered = Promise.withResolvers<void>();
  const aborted = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const stop = Promise.withResolvers<void>();
  fixture.onRun(async () => {
    entered.resolve();
    await stop.promise;
  });
  fixture.onAbort(async () => {
    aborted.resolve();
    await finish.promise;
  });
  const snapshot = await deps.extensionRuntimeCatalog.get(fixture.projectId);
  const input = {
    deps,
    snapshot,
    schedule: snapshot.runtime.schedules[0]!,
    ctx: { runId: "removal", reason: "live" as const, scheduledFor: new Date() },
    dispatch: (execute: () => Promise<boolean>) => execute(),
  };
  const running = executeScheduledCommand(input).catch((error) => error);
  try {
    await entered.promise;
    work.freeze(fixture.projectId);
    const drain = work.drain(fixture.projectId);
    await aborted.promise;
    await drain;
    await expectRejection(executeScheduledCommand(input)).toThrow("removing its copy");
  } finally {
    finish.resolve();
    stop.resolve();
    await running;
    work.release(fixture.projectId);
    await fixture.close();
  }
});
