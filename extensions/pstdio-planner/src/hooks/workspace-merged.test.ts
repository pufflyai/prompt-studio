import { describe, expect, mock, test } from "bun:test";
import { gitMergedHook } from "./workspace-merged";

describe("gitMergedHook", () => {
  test("resolves ready-to-merge notifications for the merged ticket workspace", async () => {
    const context = { notify: { resolve: mock(async () => {}) } };

    await gitMergedHook.handler(
      context as never,
      { projectId: "project-1", anchors: [{ type: "ticket", id: "PS-95" }] } as never,
    );

    expect(context.notify.resolve).toHaveBeenCalledWith({ dedupeKey: "pstdio-planner:ticket:PS-95:ready-to-merge" });
  });
});
