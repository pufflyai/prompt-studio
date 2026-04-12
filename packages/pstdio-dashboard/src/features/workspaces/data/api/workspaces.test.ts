import { afterEach, describe, expect, it, mock } from "bun:test";

import { archiveWorkspace, deleteWorkspace } from "./workspaces";

const originalFetch = globalThis.fetch;

describe("workspace api", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls archive endpoint with POST", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await archiveWorkspace("workspace-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:19840/v1/workspaces/workspace-1/archive",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("calls delete endpoint with DELETE", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await deleteWorkspace("workspace-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:19840/v1/workspaces/workspace-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
