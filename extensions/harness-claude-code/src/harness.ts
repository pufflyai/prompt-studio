import { readFileSync } from "node:fs";
import type { AgentModel, HarnessContext, HarnessProvider } from "@pstdio/sdk/extensions";
import { l10n, params } from "@pstdio/sdk/extensions";
import { discoverClaudeModels } from "./models";
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
  listModels: (ctx: HarnessContext) => Promise<AgentModel[]>;
  now: () => number;
  readTranscript: (agentSessionId: string, cwd?: string) => Promise<string>;
};

const defaultDeps: ClaudeCodeDeps = {
  detect: detectClaude,
  listModels: discoverClaudeModels,
  now: Date.now,
  readTranscript: defaultReadTranscript,
};

const MODEL_CACHE_TTL_MS = 5 * 60 * 1_000;

export const createClaudeCodeHarness = (overrides: Partial<ClaudeCodeDeps> = {}): HarnessProvider => {
  const deps = { ...defaultDeps, ...overrides };
  let modelCache: { expiresAt: number; value: Promise<AgentModel[]> } | undefined;

  const listModels = async (ctx: HarnessContext) => {
    if (!(await deps.detect(ctx)).available) return [];
    if (modelCache && modelCache.expiresAt > deps.now()) return modelCache.value;

    const value = deps.listModels(ctx).catch((error) => {
      modelCache = undefined;
      ctx.logger.warn(`Claude model discovery failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    });
    modelCache = { expiresAt: deps.now() + MODEL_CACHE_TTL_MS, value };
    return value;
  };

  return {
    id: "claude-code",
    label: l10n("harness.claudeCode", "Claude Code"),
    skills: { dir: ".claude/skills" },
    params: {
      thinking: params.select({
        label: "Thinking",
        defaultValue: "high",
        options: [
          { label: "Low", value: "low", icon: "Gauge" },
          { label: "Medium", value: "medium", icon: "Brain" },
          { label: "High", value: "high", icon: "Zap" },
          { label: "XHigh", value: "xhigh", icon: "Flame" },
          { label: "Max", value: "max", icon: "Sparkles" },
        ],
      }),
    },

    capabilities: () => ["SessionFork", "ContextUsage", "Approvals"],
    detect: (ctx) => deps.detect(ctx),
    listModels,

    start: (ctx, input) =>
      startClaudeCodeSession({
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
        params: input.params,
        cwd: input.cwd,
        env: sessionEnv(ctx, input.sessionId),
        events: input.events,
      }),

    resume: (ctx, input) =>
      resumeClaudeCodeSession({
        agentSessionId: input.agentSessionId,
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
        params: input.params,
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
