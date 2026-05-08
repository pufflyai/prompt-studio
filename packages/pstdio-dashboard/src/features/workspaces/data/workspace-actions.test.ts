import { afterEach, describe, expect, it, mock } from "bun:test";
import { deleteWorkspace } from "./workspace-actions";

const originalFetch = globalThis.fetch;

describe("workspace actions api", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("deletes a workspace via DELETE /v1/workspaces/:id", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await deleteWorkspace("ws-2");

    expect(fetchMock).toHaveBeenCalledWith("/v1/workspaces/ws-2", expect.objectContaining({ method: "DELETE" }));
  });
});
