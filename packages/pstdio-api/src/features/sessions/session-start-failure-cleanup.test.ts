import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
  cleanupSessionAttachmentTestRoots,
  createIsolatedApp,
  createProject,
  FAKE_ID,
  waitForSessionStatus,
} from "./endpoints/session-attachments.test-utils";
import { createSessionScheduler } from "./session-scheduler";

const unhandled: unknown[] = [];
const collectUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  unhandled.length = 0;
  process.on("unhandledRejection", collectUnhandled);
});

afterEach(() => {
  process.off("unhandledRejection", collectUnhandled);
});

afterAll(() => {
  cleanupSessionAttachmentTestRoots();
});

describe("session start failure cleanup", () => {
  test("logs a failed cleanup instead of leaving an unhandled rejection", async () => {
    const isolated = await createIsolatedApp({ startThrows: true });
    try {
      const project = await createProject(isolated.app, "Start Failure Cleanup Project");
      const cleanupFailed = Promise.withResolvers<void>();
      spyOn(isolated.deps.sessionService, "transitionStatus").mockImplementationOnce(async () => {
        cleanupFailed.resolve();
        throw new Error("database write failed");
      });

      await createSessionScheduler(isolated.deps).createSession({
        projectId: project.id,
        title: "Start failure",
        agentId: FAKE_ID,
        prompt: "the harness fails to start",
      });
      await cleanupFailed.promise;
      await Bun.sleep(20);

      expect(unhandled).toEqual([]);
    } finally {
      await isolated.close();
    }
  });

  test("a failed queued dispatch does not fail the status change that released capacity", async () => {
    const isolated = await createIsolatedApp({ deferExit: true });
    try {
      const project = await createProject(isolated.app, "Queued Dispatch Failure Project");
      await isolated.deps.settingsService.update({ max_concurrent_sessions: 1 });
      const holder = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Capacity holder",
        agent: FAKE_ID,
        cwd: "/tmp",
      });
      const queued = await isolated.deps.sessionService.createQueuedWithEntry(
        {
          project_id: project.id,
          title: "Queued session",
          agent: FAKE_ID,
          cwd: "/tmp",
          prompt: "start after the holder finishes",
          request_kind: "start",
        },
        { emitStartedHook: false },
      );
      spyOn(isolated.deps.sessionQueueEntriesService, "remove").mockRejectedValueOnce(
        new Error("queue entry removal failed"),
      );

      await expect(isolated.deps.sessionService.transitionStatus(holder.id, "completed")).resolves.toMatchObject({
        status: "completed",
      });
      await waitForSessionStatus(isolated.app, queued.id, "in_progress");
    } finally {
      isolated.harness.completeAll();
      await isolated.close();
    }
  });
});
