import { afterEach, describe, expect, mock, test } from "bun:test";
import { removeAgent } from "./remove-agent";

const originalFetch = globalThis.fetch;

const mockFetch = (status: number, body?: unknown) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(body ? JSON.stringify(body) : null, { status })),
  ) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("removeAgent", () => {
  test("resolves on 204", async () => {
    mockFetch(204);

    await removeAgent("http://test:3000", "claude-code");
  });

  test("throws on 404", async () => {
    mockFetch(404, { error: "Agent not found" });

    expect(removeAgent("http://test:3000", "unknown")).rejects.toThrow("Agent not found: unknown");
  });

  test("throws on other errors", async () => {
    mockFetch(500, { error: "Internal" });

    expect(removeAgent("http://test:3000", "claude-code")).rejects.toThrow("Failed to remove agent: 500");
  });
});
