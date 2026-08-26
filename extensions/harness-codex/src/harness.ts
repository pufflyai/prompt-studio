import type { AgentModel, HarnessContext, HarnessProvider } from "@pstdio/sdk/extensions";
import { l10n, params } from "@pstdio/sdk/extensions";
import { discoverCodexModels } from "./models";
import { normalizeRollout, readRollout } from "./rollout";
import { resumeCodexSession, startCodexSession } from "./spawn";

const detectCodex = async (ctx: HarnessContext) => {
  try {
    const result = await ctx.process.run({ command: ["codex", "--version"] });
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

type CodexDeps = {
  detect: typeof detectCodex;
  listModels: (ctx: HarnessContext) => Promise<AgentModel[]>;
  now: () => number;
  readTranscript: (agentSessionId: string) => Promise<string>;
};

const defaultDeps: CodexDeps = {
  detect: detectCodex,
  listModels: discoverCodexModels,
  now: Date.now,
  readTranscript: readRollout,
};

const MODEL_CACHE_TTL_MS = 5 * 60 * 1_000;

export const createCodexHarness = (overrides: Partial<CodexDeps> = {}): Omit<HarnessProvider, "ref"> => {
  const deps = { ...defaultDeps, ...overrides };
  let modelCache: { expiresAt: number; value: Promise<AgentModel[]> } | undefined;

  const listModels = async (ctx: HarnessContext) => {
    if (!(await deps.detect(ctx)).available) return [];
    if (modelCache && modelCache.expiresAt > deps.now()) return modelCache.value;

    const value = deps.listModels(ctx).catch((error) => {
      modelCache = undefined;
      ctx.logger.warn(`Codex model discovery failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    });
    modelCache = { expiresAt: deps.now() + MODEL_CACHE_TTL_MS, value };
    return value;
  };

  return {
    id: "codex",
    label: l10n("harness.codex", "Codex"),
    skills: { dir: ".agents/skills" },
    params: {
      model_reasoning_effort: params.select({
        label: "Reasoning effort",
        defaultValue: "medium",
        options: [
          { label: "Minimal", value: "minimal", icon: "CircleDot" },
          { label: "Low", value: "low", icon: "Gauge" },
          { label: "Medium", value: "medium", icon: "Brain" },
          { label: "High", value: "high", icon: "Zap" },
          { label: "XHigh", value: "xhigh", icon: "Flame" },
        ],
      }),
    },

    // codex exec is non-interactive: no approval channel, so no Approvals capability.
    capabilities: () => ["ContextUsage"],
    detect: (ctx) => deps.detect(ctx),
    listModels,

    start: (ctx, input) =>
      startCodexSession({
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
        params: input.params,
        cwd: input.cwd,
        env: sessionEnv(ctx, input.sessionId),
        events: input.events,
      }),

    resume: (ctx, input) =>
      resumeCodexSession({
        agentSessionId: input.agentSessionId,
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
        params: input.params,
        cwd: input.cwd,
        env: sessionEnv(ctx, input.sessionId),
        events: input.events,
        messageOffset: input.messageOffset,
      }),

    getMessages: async (_ctx, input) => normalizeRollout(await deps.readTranscript(input.agentSessionId)),
  };
};
