import type { AgentModel, HarnessContext, HarnessProvider } from "@pstdio/sdk/extensions";
import { l10n, params } from "@pstdio/sdk/extensions";
import { createCodexRuntime } from "./codex-runtime";
import { codexCommandState, prepareCodexOperation } from "./commands";
import { discoverCodexModels } from "./models";
import { recoverNativeHistory } from "./native-history";
import type { ThreadGoal } from "./protocol/v2/ThreadGoal";

const detectCodex = async (ctx: HarnessContext) => {
  try {
    const result = await ctx.process.run({ command: ["codex", "--version"] });
    if (result.exitCode !== 0) return { available: false };
    const version = result.stdout.trim();
    const number = version.match(/\d+\.\d+\.\d+/)?.[0];
    return { available: Boolean(number && Bun.semver.satisfies(number, "^0.159.3")), version };
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
  runtime: ReturnType<typeof createCodexRuntime>;
};

const defaultDeps: Omit<CodexDeps, "runtime"> = {
  detect: detectCodex,
  listModels: discoverCodexModels,
  now: Date.now,
};

const MODEL_CACHE_TTL_MS = 5 * 60 * 1_000;

export const createCodexHarness = (overrides: Partial<CodexDeps> = {}): Omit<HarnessProvider, "ref"> => {
  const deps = { ...defaultDeps, ...overrides, runtime: overrides.runtime ?? createCodexRuntime() };
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
      collaboration_mode: params.select({
        label: "Collaboration",
        defaultValue: "default",
        options: [
          { label: "Default", value: "default" },
          { label: "Planning", value: "plan" },
        ],
      }),
      model_reasoning_effort: params.select({
        label: "Reasoning effort",
        defaultValue: "medium",
        options: [
          { label: "Minimal", value: "minimal", icon: "level-low" },
          { label: "Low", value: "low", icon: "level-low" },
          { label: "Medium", value: "medium", icon: "level-mid" },
          { label: "High", value: "high", icon: "level-high" },
          { label: "XHigh", value: "xhigh", icon: "level-xhigh" },
        ],
      }),
    },

    getCommandState: async (ctx, input) => {
      if (!input.agentSessionId) return codexCommandState(input, null);
      const worker = deps.runtime.worker({
        ...input,
        prompt: "",
        events: { getMessages: () => [], push: () => {} },
        env: sessionEnv(ctx, input.sessionId),
      });
      const result = (await worker.request("thread/goal/get", { threadId: input.agentSessionId })) as {
        goal: ThreadGoal | null;
      };
      return codexCommandState(input, result.goal);
    },
    prepareOperation: (ctx, input, operation) => prepareCodexOperation(input, operation, deps.runtime, ctx.projectId),
    // Host-managed worktrees run without provider approvals.
    capabilities: () => ["ContextUsage"],
    detect: (ctx) => deps.detect(ctx),
    listModels,

    start: (ctx, input) =>
      deps.runtime.run({
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
        params: input.params,
        cwd: input.cwd,
        env: sessionEnv(ctx, input.sessionId),
        events: input.events,
        signal: input.signal,
      }),

    resume: (ctx, input) =>
      deps.runtime.run({
        agentSessionId: input.agentSessionId,
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
        params: input.params,
        cwd: input.cwd,
        env: sessionEnv(ctx, input.sessionId),
        events: input.events,
        signal: input.signal,
        messageOffset: input.messageOffset,
        questionResponse: input.questionResponse,
      }),

    getMessages: (ctx, input) => deps.runtime.readMessages({ ...input, env: sessionEnv(ctx, input.agentSessionId) }),
    recoverMessages: (_ctx, input) => recoverNativeHistory(input),
    dispose: (ctx) => deps.runtime.disposeScope(ctx.projectId),
  };
};
