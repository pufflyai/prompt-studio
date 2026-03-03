import { describe, expect, test } from "bun:test";
import { findAgent, isKnownAgentId, KNOWN_AGENT_IDS, KNOWN_AGENTS } from "./known-agents";

describe("known-agents", () => {
  test("contains claude-code and opencode", () => {
    expect(KNOWN_AGENT_IDS).toEqual(["claude-code", "opencode"]);
  });

  test("each agent has required metadata", () => {
    for (const agent of KNOWN_AGENTS) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.binary).toBeDefined();
      expect(agent.skillsDir).toBeDefined();
      expect(agent.globalSkillsDir).toBeDefined();
    }
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
