import { afterEach, describe, expect, mock, test } from "bun:test";
import { listAgents } from "./list-agents";

const originalFetch = globalThis.fetch;

const mockFetch = (status: number, body: unknown) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  ) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("listAgents", () => {
  test("returns agents on 200", async () => {
    const agents = [
      { id: "1", agent_id: "claude-code", is_default: true, config: "{}", created_at: "t", updated_at: "t" },
    ];
    mockFetch(200, agents);

    const result = await listAgents("http://test:3000");
    expect(result).toEqual(agents);
  });

  test("throws on non-ok response", async () => {
    mockFetch(500, { error: "Internal" });

    expect(listAgents("http://test:3000")).rejects.toThrow("Failed to list agents: 500");
  });
});
