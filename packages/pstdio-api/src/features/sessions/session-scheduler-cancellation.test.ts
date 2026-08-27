import { describe, expect, mock, test } from "bun:test";
import { createSessionScheduler } from "./session-scheduler";

describe("session scheduler cancellation", () => {
  test("removes a follow-up inserted while its request is cancelled", async () => {
    const inserted = Promise.withResolvers<{ queue_position: number }>();
    const remove = mock(async () => {});
    const session = {
      id: "session-1",
      project_id: "project-1",
      status: "in_progress",
      agent: "pstdio.harness.test",
      last_selected_model: null,
    };
    const controller = new AbortController();
    const scheduler = createSessionScheduler({
      sessionService: {
        get: async () => session,
        insertEntryForActive: async () => inserted.promise,
      },
      sessionQueueEntriesService: { remove },
    } as never);

    const scheduling = scheduler.startOrQueueExisting({
      session: session as never,
      prompt: "follow up",
      signal: controller.signal,
    });
    await Bun.sleep(0);
    controller.abort(new DOMException("cancelled", "AbortError"));
    inserted.resolve({ queue_position: 7 });

    await expect(scheduling).rejects.toThrow();
    expect(remove).toHaveBeenCalledWith(7);
  });
});
