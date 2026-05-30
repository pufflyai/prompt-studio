import { describe, expect, test } from "bun:test";
import { findAgent } from "./known-agents";

describe("known-agents", () => {
  test("opencode uses the shared agent skills directory", () => {
    const agent = findAgent("opencode");

    expect(agent?.skillsDir).toBe(".agents/skills");
    expect(agent?.globalSkillsDir).toBe(".agents/skills");
  });
});
