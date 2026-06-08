import { afterEach, describe, expect, it, mock } from "bun:test";

import { ATTEMPT_DIFF_MODE } from "@/shared/workspace-diff-api";
import { createTicketAttempt, getTicketAttemptDiff } from "./attempts";

const originalFetch = globalThis.fetch;

describe("getTicketAttemptDiff", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("uses fork_point mode for attempt diff surfaces", async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            workspace_id: "ws-1",
            totals: { additions: 1, deletions: 0, file_count: 1 },
            files: [],
          }),
          { status: 200 },
        ),
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await getTicketAttemptDiff("ws-1", ATTEMPT_DIFF_MODE);

    expect(ATTEMPT_DIFF_MODE).toBe("fork_point");
    expect(fetchMock).toHaveBeenCalledWith("/v1/workspaces/ws-1/diff?mode=fork_point", expect.any(Object));
  });
});

describe("createTicketAttempt", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("accepts workspace-only responses without a session", async () => {
    const fetchMock = mock(
      async () =>
        new Response(
          JSON.stringify({
            commandId: "pstdio-planner.run-attempt",
            extensionId: "pstdio-planner",
            outcome: {
              ok: true,
              status: "success",
              value: {
                mode: "worktree",
                ticket: { id: "ticket-1" },
                workspace: {
                  id: "workspace-1",
                  workspace_shorthand: "PS-72_A1",
                },
                session: null,
              },
            },
          }),
          { status: 200 },
        ),
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      createTicketAttempt({ projectId: "project-1", ticketId: "ticket-1", startSession: false }),
    ).resolves.toEqual({
      ticketId: "ticket-1",
      sessionId: null,
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-72_A1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/projects/project-1/extensions/commands/pstdio-planner.run-attempt/execute",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ params: { ticket: "ticket-1", mode: "worktree", startSession: false } }),
      }),
    );
  });
});
