import { afterEach, describe, expect, mock, test } from "bun:test";
import { updateAgent } from "./update-agent";

const originalFetch = globalThis.fetch;

const mockFetch = (status: number, body: unknown) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  ) as unknown as typeof fetch;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("updateAgent", () => {
  test("returns updated agent config on 200", async () => {
    const agent = {
      id: "1",
      agent_id: "opencode",
      is_default: true,
      config: "{}",
      created_at: "t",
      updated_at: "t",
    };
    mockFetch(200, agent);

    const result = await updateAgent("http://test:3000", "opencode", { is_default: true });
    expect(result).toEqual(agent);
  });

  test("throws on 404", async () => {
    mockFetch(404, { error: "Agent not found" });

    expect(updateAgent("http://test:3000", "unknown", { is_default: true })).rejects.toThrow(
      "Agent not found: unknown",
    );
  });

  test("throws on other errors", async () => {
    mockFetch(500, { error: "Internal" });

    expect(updateAgent("http://test:3000", "opencode", { is_default: true })).rejects.toThrow(
      "Failed to update agent: 500",
    );
  });
});
