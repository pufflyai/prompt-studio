import type { AgentId, SessionMessage } from "../../agent-types";

import claudeBashHeavy from "./claude-code/bash-heavy.parsed.json";
import claudeTodowriteEdit from "./claude-code/todowrite-edit.parsed.json";
import claudeWebSearch from "./claude-code/web-search.parsed.json";
import claudeWithErrors from "./claude-code/with-errors.parsed.json";
import opencodeMultiTool from "./opencode/multi-tool.parsed.json";
import opencodePlanningGlob from "./opencode/planning-glob.parsed.json";
import opencodeReasoningRich from "./opencode/reasoning-rich.parsed.json";

export type ConversationFixture = {
  id: string;
  agent: AgentId;
  label: string;
  description: string;
  messages: SessionMessage[];
};

const claude = (id: string, label: string, description: string, data: unknown): ConversationFixture => ({
  id: `claude-code/${id}`,
  agent: "claude-code",
  label,
  description,
  messages: data as SessionMessage[],
});

const opencode = (id: string, label: string, description: string, data: unknown): ConversationFixture => ({
  id: `opencode/${id}`,
  agent: "opencode",
  label,
  description,
  messages: data as SessionMessage[],
});

export const fixtures: ConversationFixture[] = [
  claude(
    "todowrite-edit",
    "TodoWrite + Edit + Read",
    "Plan-driven implementation: TodoWrite scaffolds tasks, Read scans code, Edit applies changes.",
    claudeTodowriteEdit,
  ),
  claude("bash-heavy", "Bash + Read", "Investigation flow dominated by Bash and Read tool calls.", claudeBashHeavy),
  claude("with-errors", "Tool errors", "Conversation with tool failures so error states render.", claudeWithErrors),
  claude(
    "web-search",
    "WebFetch / WebSearch",
    "Short conversation that invokes both WebFetch and WebSearch network tools.",
    claudeWebSearch,
  ),
  opencode(
    "planning-glob",
    "Plan mode + glob",
    "Plan-mode opencode session showing reasoning and glob/grep tool sequence.",
    opencodePlanningGlob,
  ),
  opencode(
    "multi-tool",
    "Read / Edit / Bash mix",
    "Long-running session with mixed tool usage (read, edit, bash, todowrite).",
    opencodeMultiTool,
  ),
  opencode(
    "reasoning-rich",
    "Reasoning-heavy turn",
    "Session with extended reasoning blocks alongside tool calls.",
    opencodeReasoningRich,
  ),
];

export const fixturesById = new Map(fixtures.map((f) => [f.id, f]));
