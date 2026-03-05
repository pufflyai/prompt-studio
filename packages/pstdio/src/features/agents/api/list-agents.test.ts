import { describe, expect, test } from "bun:test";
import { mockFetch } from "@/test-utils/mock-fetch";
import { listAgents } from "./list-agents";

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
