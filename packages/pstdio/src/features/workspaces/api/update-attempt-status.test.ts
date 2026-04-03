import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { updateAttemptStatus } from "./update-attempt-status";

describe("updateAttemptStatus", () => {
  test("includes session_id when provided", async () => {
    mockFetch(200, { ok: true });

    await updateAttemptStatus("http://test:3000", "ws-1", "review-ready", "sess-1");

    const fetchMock = globalThis.fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } };
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.body).toBe(JSON.stringify({ status: "review-ready", session_id: "sess-1" }));
  });

  test("includes hook output when pre-hook rejects transition", async () => {
    mockFetch(422, {
      error: "Pre-hook rejected the transition",
      hook_output: "tests failing",
    });

    expect(updateAttemptStatus("http://test:3000", "ws-1", "review-ready")).rejects.toThrow(
      "Pre-hook rejected the transition\ntests failing",
    );
  });
});
