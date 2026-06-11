import { describe, expect, test } from "bun:test";
import { findAgent, harnessLocalId } from "./known-agents";

describe("known-agents", () => {
  test("opencode uses the shared agent skills directory", () => {
    const agent = findAgent("opencode");

    expect(agent?.skillsDir).toBe(".agents/skills");
    expect(agent?.globalSkillsDir).toBe(".agents/skills");
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
