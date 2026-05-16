import { describe, expect, test } from "bun:test";
import { resolveDefaultHarnessId, toHarnessRows } from "./harness-settings";

const agent = (id: string, name = id) => ({
  id,
  name,
  availability: { type: "INSTALLED" },
});

const config = (agentId: string, isDefault = false) => ({
  id: `${agentId}-config`,
  agent_id: agentId,
  is_default: isDefault,
  config: "{}",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("harness settings", () => {
  test("keeps the project default harness when one is configured", () => {
    const rows = toHarnessRows([agent("claude-code"), agent("opencode")], [config("opencode", true)]);

    expect(resolveDefaultHarnessId("claude-code", rows)).toBe("claude-code");
  });

  test("falls back to the global default harness", () => {
    const rows = toHarnessRows([agent("claude-code"), agent("opencode")], [config("opencode", true)]);

    expect(resolveDefaultHarnessId(null, rows)).toBe("opencode");
  });

  test("falls back to the first enabled harness", () => {
    const rows = toHarnessRows([agent("claude-code"), agent("opencode")], [config("claude-code"), config("opencode")]);

    expect(resolveDefaultHarnessId(null, rows)).toBe("claude-code");
  });
});
