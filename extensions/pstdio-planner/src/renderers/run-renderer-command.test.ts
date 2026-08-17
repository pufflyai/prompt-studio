import { describe, expect, test } from "bun:test";
import { runRendererCommand } from "./run-renderer-command";

describe("runRendererCommand", () => {
  test("binds the shared renderer resource to the reused planner command", () => {
    const resource = { type: "ticket", id: "ticket-1" };
    const command = {
      run: (ctx: { params: object; resource?: unknown }) => ctx,
    };

    const result = runRendererCommand(command, {
      renderer: {
        rendererId: "pstdio-planner.ticketContent",
        projectId: "project-1",
        resource,
        invocation: { placement: "visible" },
      },
    })({ projectId: "project-1" });

    expect(result.resource).toEqual(resource);
  });
});
