import { afterEach, describe, expect, it, mock } from "bun:test";
import { createWorkspaceSession } from "./use-create-workspace-session";

const originalFetch = globalThis.fetch;

describe("createWorkspaceSession", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends the selected workspace id in the session create request", async () => {
    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify({ id: "session-123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await createWorkspaceSession("project-1", {
      workspaceId: "ws-2",
      prompt: "Implement ticket: PS-13",
      agent: "opencode",
      model: null,
    });

    expect(result).toEqual({ sessionId: "session-123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:19840/v1/sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          project_id: "project-1",
          workspace_id: "ws-2",
          title: "Implement ticket: PS-13",
          prompt: "Implement ticket: PS-13",
          agent: "opencode",
          model: undefined,
        }),
      }),
    );
  });
});
