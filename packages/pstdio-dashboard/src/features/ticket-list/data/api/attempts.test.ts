import { afterEach, describe, expect, it, mock } from "bun:test";

import { ATTEMPT_DIFF_MODE, createTicketAttempt, getTicketAttemptDiff } from "./attempts";

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
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:19840/v1/workspaces/ws-1/diff?mode=fork_point",
      expect.any(Object),
    );
  });
});

describe("createTicketAttempt", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("accepts workspace-only responses without a session", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/v1/projects/project-1/extensions/pstdio.planner/collections/tickets")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                item_id: "ticket-1",
                value_json: {
                  id: "ticket-1",
                  shorthand: "PS-72",
                  displayTitle: "Ticket title",
                  content: "# Ticket title\n",
                },
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          id: "workspace-1",
          workspace_shorthand: "PS-72_A1",
        }),
        { status: 201 },
      );
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(createTicketAttempt("project-1", { ticketId: "ticket-1", startSession: false })).resolves.toEqual({
      ticketId: "ticket-1",
      sessionId: null,
      workspaceId: "workspace-1",
      workspaceShorthand: "PS-72_A1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:19840/v1/workspaces",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"type":"pstdio.planner.ticket"'),
      }),
    );
  });
});
