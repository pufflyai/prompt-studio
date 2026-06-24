import { describe, expect, mock, test } from "bun:test";
import { sessionSucceededHook } from "./session-completed";

const ctx = () => ({ notify: { action: mock(async () => {}) } });
const payload = (sessionTitle?: string) => ({
  projectId: "project-1",
  sessionId: "session-1",
  sessionTitle,
  workspaceId: "workspace-1",
  anchors: [{ type: "ticket", id: "PS-95" }],
});

describe("sessionSucceededHook", () => {
  test("emits ready-to-merge from the session title", async () => {
    const context = ctx();

    await sessionSucceededHook.handler(context as never, payload("Implement ticket: PS-95") as never);

    expect(context.notify.action).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "ready_to_merge",
        dedupeKey: "pstdio-planner:ticket:PS-95:ready-to-merge",
      }),
    );
  });

  test("does not infer lifecycle notifications from workspace labels", async () => {
    const context = ctx();

    await sessionSucceededHook.handler(
      context as never,
      {
        ...payload(),
        workspace: { name: "Implement ticket: PS-95", anchors_json: [{ type: "ticket", id: "PS-95" }] },
      } as never,
    );

    expect(context.notify.action).not.toHaveBeenCalled();
  });
});
