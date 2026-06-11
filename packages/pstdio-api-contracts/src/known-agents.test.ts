import { describe, expect, test } from "bun:test";
import { findAgent, harnessLocalId, isKnownAgentId, KNOWN_AGENT_IDS } from "./known-agents";

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

  test("opencode uses the shared agent skills directory", () => {
    const agent = findAgent("opencode");

    expect(agent?.skillsDir).toBe(".agents/skills");
    expect(agent?.globalSkillsDir).toBe(".agents/skills");
  });

  test("findAgent returns null for unknown id", () => {
    expect(findAgent("unknown")).toBeNull();
  });

  test("isKnownAgentId validates known ids", () => {
    expect(isKnownAgentId("claude-code")).toBe(true);
    expect(isKnownAgentId("opencode")).toBe(true);
    expect(isKnownAgentId("codex")).toBe(false);
  });

  test("harnessLocalId strips the extension namespace", () => {
    expect(harnessLocalId("pstdio.harness-claude-code.claude-code")).toBe("claude-code");
    expect(harnessLocalId("claude-code")).toBe("claude-code");
  });

  test("findAgent reconciles namespaced harness ids via their local id", () => {
    expect(findAgent("pstdio.harness-claude-code.claude-code")?.binary).toBe("claude");
    expect(findAgent("pstdio.harness-open-code.opencode")?.binary).toBe("opencode");
    expect(findAgent("acme.acme-agent.my-agent")).toBeNull();
  });
});
