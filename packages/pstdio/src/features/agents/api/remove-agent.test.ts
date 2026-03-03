import { afterEach, describe, expect, mock, test } from "bun:test";
import { removeAgent } from "./remove-agent";

const originalFetch = globalThis.fetch;

let lastFetchUrl: string | undefined;

const mockFetch = (status: number, body?: unknown) => {
  globalThis.fetch = mock((url: string) => {
    lastFetchUrl = url;
    return Promise.resolve(new Response(body ? JSON.stringify(body) : null, { status }));
  }) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  lastFetchUrl = undefined;
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

  test("sends delete_skills query param when deleteSkills is true", async () => {
    mockFetch(204);

    await removeAgent("http://test:3000", "claude-code", { deleteSkills: true });

    expect(lastFetchUrl).toBe("http://test:3000/v1/agents/claude-code?delete_skills=true");
  });

  test("does not send delete_skills query param by default", async () => {
    mockFetch(204);

    await removeAgent("http://test:3000", "claude-code");

    expect(lastFetchUrl).toBe("http://test:3000/v1/agents/claude-code");
  });
});
