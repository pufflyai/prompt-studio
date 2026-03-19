import { afterEach, describe, expect, it, mock } from "bun:test";

import { ATTEMPT_DIFF_MODE, getTicketAttemptDiff } from "./attempts";

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
