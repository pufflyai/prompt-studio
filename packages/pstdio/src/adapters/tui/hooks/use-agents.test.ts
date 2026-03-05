import { describe, expect, it } from "bun:test";
import { buildAgentRows } from "./use-agents";

const AGENTS = [
  {
    id: "claude-code" as const,
    name: "Claude Code",
    binary: "claude",
    skillsDir: ".claude/skills",
    globalSkillsDir: ".claude/skills",
  },
  {
    id: "opencode" as const,
    name: "OpenCode",
    binary: "opencode",
    skillsDir: ".opencode/skills",
    globalSkillsDir: ".opencode/skills",
  },
];

describe("buildAgentRows", () => {
  it("returns all agents unconfigured when API returns empty", () => {
    const rows = buildAgentRows(AGENTS, [], () => false);

    expect(rows).toEqual([
      { agentId: "claude-code", name: "Claude Code", configured: false, installed: false, isDefault: false },
      { agentId: "opencode", name: "OpenCode", configured: false, installed: false, isDefault: false },
    ]);
  });

  it("marks a matching agent as configured", () => {
    const configured = [{ id: "1", agent_id: "claude-code", is_default: false }];
    const rows = buildAgentRows(AGENTS, configured, () => false);

    expect(rows[0].configured).toBe(true);
    expect(rows[1].configured).toBe(false);
  });

  it("marks the default agent correctly", () => {
    const configured = [
      { id: "1", agent_id: "claude-code", is_default: true },
      { id: "2", agent_id: "opencode", is_default: false },
    ];
    const rows = buildAgentRows(AGENTS, configured, () => false);

    expect(rows[0].isDefault).toBe(true);
    expect(rows[1].isDefault).toBe(false);
  });

  it("passes through checkInstalled result", () => {
    const checkInstalled = (binary: string) => binary === "claude";
    const rows = buildAgentRows(AGENTS, [], checkInstalled);

    expect(rows[0].installed).toBe(true);
    expect(rows[1].installed).toBe(false);
  });

  it("handles mixed states across agents", () => {
    const configured = [{ id: "1", agent_id: "opencode", is_default: true }];
    const checkInstalled = (binary: string) => binary === "claude";
    const rows = buildAgentRows(AGENTS, configured, checkInstalled);

    expect(rows[0]).toEqual({
      agentId: "claude-code",
      name: "Claude Code",
      configured: false,
      installed: true,
      isDefault: false,
    });
    expect(rows[1]).toEqual({
      agentId: "opencode",
      name: "OpenCode",
      configured: true,
      installed: false,
      isDefault: true,
    });
  });
});
