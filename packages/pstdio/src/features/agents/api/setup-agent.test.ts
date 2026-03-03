import { afterEach, describe, expect, mock, test } from "bun:test";
import { setupAgent } from "./setup-agent";

const originalFetch = globalThis.fetch;

const mockFetch = (status: number, body: unknown) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  ) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("setupAgent", () => {
  test("returns agent config on 201", async () => {
    const agent = {
      id: "1",
      agent_id: "claude-code",
      is_default: true,
      config: "{}",
      created_at: "t",
      updated_at: "t",
    };
    mockFetch(201, agent);

    const result = await setupAgent("http://test:3000", "claude-code");
    expect(result).toEqual(agent);
  });

  test("throws on non-ok response", async () => {
    mockFetch(500, { error: "Internal" });

    expect(setupAgent("http://test:3000", "claude-code")).rejects.toThrow("Failed to setup agent: 500");
  });
});
