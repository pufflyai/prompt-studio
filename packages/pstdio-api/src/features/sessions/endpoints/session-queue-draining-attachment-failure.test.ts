import { afterAll, describe, expect, test } from "bun:test";
import {
  cleanupSessionAttachmentTestRoots,
  createIsolatedApp,
  createProject,
  FAKE_ID,
  waitForSessionStatus,
} from "./session-attachments.test-utils";

afterAll(() => {
  cleanupSessionAttachmentTestRoots();
});

describe("session queue draining with a corrupted attachment entry", () => {
  test("fails the unresolvable entry and still drains the next queued session", async () => {
    // deferExit keeps the dispatched healthy session pending in "in_progress" so its exit
    // tracking does not race the app teardown below.
    const isolated = await createIsolatedApp({ deferExit: true });
    try {
      const project = await createProject(isolated.app, "Corrupted Attachment Drain Project");

      // Cap concurrency so the sessions below queue behind a capacity holder.
      await isolated.app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: 1 }),
      });

      const holder = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Capacity holder",
        agent: FAKE_ID,
        cwd: "/tmp",
      });

      // References an attachment file that no longer exists, so resolveSessionAttachments throws.
      const corrupted = await isolated.deps.sessionService.createQueuedWithEntry(
        {
          project_id: project.id,
          title: "Corrupted attachment session",
          agent: FAKE_ID,
          cwd: "/tmp",
          prompt: "uses a missing attachment",
          request_kind: "start",
          attachments_json: [{ file_id: "missing-attachment-file-id" }],
        },
        { emitStartedHook: false },
      );

      const healthy = await isolated.deps.sessionService.createQueuedWithEntry(
        {
          project_id: project.id,
          title: "Healthy queued session",
          agent: FAKE_ID,
          cwd: "/tmp",
          prompt: "no attachments",
          request_kind: "start",
        },
        { emitStartedHook: false },
      );

      // Freeing capacity drains the queue starting from the corrupted entry.
      await isolated.deps.sessionService.transitionStatus(holder.id, "completed");

      await waitForSessionStatus(isolated.app, corrupted.id, "failed");
      await waitForSessionStatus(isolated.app, healthy.id, "in_progress");

      expect(await isolated.deps.sessionQueueEntriesService.listPending()).toEqual([]);
      expect(await isolated.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
    } finally {
      await isolated.close();
    }
  });
});
