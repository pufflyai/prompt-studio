import { describe, expect, test } from "bun:test";
import { runReviewCommand } from "./run-review";

describe("runReviewCommand", () => {
  test("marks created sessions as reviews so generic work tracking ignores them", async () => {
    const creates: unknown[] = [];

    await runReviewCommand.run({
      params: { workspaceId: "workspace-1", ticket: "PS-7" },
      sessions: {
        create: async (input: unknown) => {
          creates.push(input);
          return { id: "session-1" };
        },
      },
    } as never);

    expect(creates).toEqual([
      expect.objectContaining({
        workspaceId: "workspace-1",
        anchors: [{ type: "planner-review", id: "PS-7", label: "PS-7" }],
      }),
    ]);
  });
});
