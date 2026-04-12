import { afterEach, describe, expect, it, mock } from "bun:test";
import { stopSession } from "./use-stop-session";

const originalFetch = globalThis.fetch;

describe("stopSession", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("patches session status to cancelled", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await stopSession("session-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as unknown as [string, RequestInit];
    expect(url).toContain("/v1/sessions/session-123/status");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ status: "cancelled" }));
  });
});
