import { describe, expect, test } from "bun:test";
import { findAgent, isKnownAgentId, KNOWN_AGENT_IDS } from "./known-agents";

describe("known-agents", () => {
  test("contains claude-code and opencode", () => {
    expect(KNOWN_AGENT_IDS).toEqual(["claude-code", "opencode"]);
  });

  test("findAgent returns agent by id", () => {
    const agent = findAgent("claude-code");
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("Claude Code");
    expect(agent!.binary).toBe("claude");
  });

  test("findAgent returns null for unknown id", () => {
    expect(findAgent("unknown")).toBeNull();
  });

  test("isKnownAgentId validates known ids", () => {
    expect(isKnownAgentId("claude-code")).toBe(true);
    expect(isKnownAgentId("opencode")).toBe(true);
    expect(isKnownAgentId("codex")).toBe(false);
  });
});
