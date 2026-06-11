export type KnownAgentId = "claude-code" | "opencode" | "fake";

export type KnownAgent = {
  id: KnownAgentId;
  name: string;
  binary: string;
  skillsDir: string;
  globalSkillsDir: string;
};

export const KNOWN_AGENTS: KnownAgent[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    binary: "claude",
    skillsDir: ".claude/skills",
    globalSkillsDir: ".claude/skills",
  },
  {
    id: "opencode",
    name: "OpenCode",
    binary: "opencode",
    skillsDir: ".agents/skills",
    globalSkillsDir: ".agents/skills",
  },
];

export const KNOWN_AGENT_IDS = KNOWN_AGENTS.map((a) => a.id);

/** Bare provider id of a (possibly namespaced) harness id, e.g. "pstdio.harness-claude-code.claude-code" -> "claude-code". */
export const harnessLocalId = (id: string) => id.slice(id.lastIndexOf(".") + 1);

export const findAgent = (id: string) => KNOWN_AGENTS.find((a) => a.id === harnessLocalId(id)) ?? null;

export const isKnownAgentId = (id: string): id is KnownAgentId => KNOWN_AGENT_IDS.includes(id as KnownAgentId);
