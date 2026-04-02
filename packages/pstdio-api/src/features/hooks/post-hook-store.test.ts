import { describe, expect, test } from "bun:test";
import { createPostHookStore } from "./post-hook-store";

describe("PostHookStore", () => {
  test("queues a post-hook for a session", () => {
    const store = createPostHookStore();

    store.queue("sess_1", {
      hookName: "post-attempt-status-review-ready",
      statusChangeId: "sc_123",
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: { workspace: "PS-1_A1" },
    });

    const entry = store.get("sess_1");
    expect(entry).toBeDefined();
    expect(entry!.hookName).toBe("post-attempt-status-review-ready");
    expect(entry!.statusChangeId).toBe("sc_123");
  });

  test("replaces previously queued hook for same session (final-transition rule)", () => {
    const store = createPostHookStore();

    store.queue("sess_1", {
      hookName: "post-attempt-status-review-ready",
      statusChangeId: "sc_1",
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: {},
    });

    store.queue("sess_1", {
      hookName: "post-attempt-status-blocked",
      statusChangeId: "sc_2",
      projectId: "proj-1",
      fromStatus: "review-ready",
      toStatus: "blocked",
      payload: {},
    });

    const entry = store.get("sess_1");
    expect(entry!.hookName).toBe("post-attempt-status-blocked");
    expect(entry!.statusChangeId).toBe("sc_2");
  });

  test("removes entry after consume", () => {
    const store = createPostHookStore();

    store.queue("sess_1", {
      hookName: "post-attempt-status-blocked",
      statusChangeId: "sc_1",
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "blocked",
      payload: {},
    });

    const entry = store.consume("sess_1");
    expect(entry).toBeDefined();
    expect(entry!.hookName).toBe("post-attempt-status-blocked");

    expect(store.get("sess_1")).toBeUndefined();
  });

  test("consume returns undefined when no entry queued", () => {
    const store = createPostHookStore();
    expect(store.consume("sess_nonexistent")).toBeUndefined();
  });

  test("independent sessions have independent queues", () => {
    const store = createPostHookStore();

    store.queue("sess_1", {
      hookName: "post-attempt-status-review-ready",
      statusChangeId: "sc_1",
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "review-ready",
      payload: {},
    });

    store.queue("sess_2", {
      hookName: "post-attempt-status-blocked",
      statusChangeId: "sc_2",
      projectId: "proj-1",
      fromStatus: "wip",
      toStatus: "blocked",
      payload: {},
    });

    expect(store.get("sess_1")!.hookName).toBe("post-attempt-status-review-ready");
    expect(store.get("sess_2")!.hookName).toBe("post-attempt-status-blocked");
  });
});
