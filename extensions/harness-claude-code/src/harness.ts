import { readFileSync } from "node:fs";
import type { AgentModel, HarnessContext, HarnessProvider } from "@pstdio/sdk/extensions";
import { l10n } from "@pstdio/sdk/extensions";
import { normalizeClaudeCodeMessages } from "./normalize-transcript";
import { resumeClaudeCodeSession, startClaudeCodeSession } from "./spawn";
import type { ClaudeCodeTranscriptEntry } from "./types";

export const buildTranscriptPath = (agentSessionId: string, cwd?: string) => {
  const projectDir = cwd ?? process.cwd();
  const sanitized = projectDir.replace(/\//g, "-");
  return `${process.env.HOME}/.claude/projects/${sanitized}/${agentSessionId}.jsonl`;
};

const defaultReadTranscript = async (agentSessionId: string, cwd?: string) => {
  try {
    return readFileSync(buildTranscriptPath(agentSessionId, cwd), "utf8");
  } catch {
    return "";
  }
};

const isValidEntry = (parsed: unknown): parsed is ClaudeCodeTranscriptEntry => {
  if (!parsed || typeof parsed !== "object") return false;

  const record = parsed as Record<string, unknown>;

  if (typeof record.uuid !== "string" || record.uuid.length === 0) return false;
  if (!record.message) return false;

  return true;
};

export const parseTranscript = (content: string): ClaudeCodeTranscriptEntry[] => {
  if (!content.trim()) return [];

  const seen = new Map<string, number>();
  const entries: ClaudeCodeTranscriptEntry[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (!isValidEntry(parsed)) continue;
      const existingIndex = seen.get(parsed.uuid);

      if (existingIndex !== undefined) {
        entries[existingIndex] = parsed;
        continue;
      }

      seen.set(parsed.uuid, entries.length);
      entries.push(parsed);
    } catch {
      // skip malformed lines
    }
  }

  return entries;
};

const knownModels: AgentModel[] = [{ id: "sonnet" }, { id: "opus" }, { id: "haiku" }];

const detectClaude = async (ctx: HarnessContext) => {
  try {
    // CLAUDECODE is cleared so a nested session is not mistaken for the CLI itself.
    const result = await ctx.process.run({ command: ["claude", "--version"], env: { CLAUDECODE: "" } });
    if (result.exitCode !== 0) return { available: false };
    return { available: true, version: result.stdout.trim() };
  } catch {
    // A missing binary makes process.run throw rather than exit non-zero.
    return { available: false };
  }
};

const sessionEnv = (ctx: HarnessContext, sessionId: string) => ({
  PSTDIO_SESSION_ID: sessionId,
  ...(ctx.projectId ? { PSTDIO_PROJECT_ID: ctx.projectId } : {}),
});

type ClaudeCodeDeps = {
  detect: typeof detectClaude;
  readTranscript: (agentSessionId: string, cwd?: string) => Promise<string>;
};

const defaultDeps: ClaudeCodeDeps = {
  detect: detectClaude,
  readTranscript: defaultReadTranscript,
};

export const createClaudeCodeHarness = (overrides: Partial<ClaudeCodeDeps> = {}): HarnessProvider => {
  const deps = { ...defaultDeps, ...overrides };

  return {
    id: "claude-code",
    label: l10n("harness.claudeCode", "Claude Code"),
    skills: { dir: ".claude/skills" },

    capabilities: () => ["SessionFork", "ContextUsage", "Approvals"],
    detect: (ctx) => deps.detect(ctx),
    listModels: async (ctx) => ((await deps.detect(ctx)).available ? knownModels : []),

    start: (ctx, input) =>
      startClaudeCodeSession({
        prompt: input.prompt,
        model: input.model,
        cwd: input.cwd,
        env: sessionEnv(ctx, input.sessionId),
        events: input.events,
      }),

    resume: (ctx, input) =>
      resumeClaudeCodeSession({
        agentSessionId: input.agentSessionId,
        prompt: input.prompt,
        model: input.model,
        cwd: input.cwd,
        env: sessionEnv(ctx, input.sessionId),
        events: input.events,
        messageOffset: input.messageOffset,
        approvals: input.approvals,
      }),

    getMessages: async (_ctx, input) => {
      const content = await deps.readTranscript(input.agentSessionId, input.cwd);
      return normalizeClaudeCodeMessages(parseTranscript(content));
    },
  };
};
