import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { setupAgent } from "./setup-agent";

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

  test("sends binary when provided", async () => {
    const agent = {
      id: "1",
      agent_id: "claude-code",
      is_default: true,
      config: JSON.stringify({ binary: "/custom/bin/claude-code" }),
      created_at: "t",
      updated_at: "t",
    };
    mockFetch(201, agent);

    await setupAgent("http://test:3000", "claude-code", "/custom/bin/claude-code");

    const fetchMock = globalThis.fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } };
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.body).toBe(JSON.stringify({ agent_id: "claude-code", binary: "/custom/bin/claude-code" }));
  });
});
