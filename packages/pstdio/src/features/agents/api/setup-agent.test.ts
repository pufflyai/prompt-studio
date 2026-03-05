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
});
