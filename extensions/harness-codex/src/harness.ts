import type { AgentModel, HarnessContext, HarnessProvider } from "@pstdio/sdk/extensions";
import { l10n, params } from "@pstdio/sdk/extensions";
import { normalizeRollout, readRollout } from "./rollout";
import { resumeCodexSession, startCodexSession } from "./spawn";

const knownModels: AgentModel[] = [{ id: "gpt-5.5" }, { id: "gpt-5.3-codex" }];

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
  readTranscript: (agentSessionId: string) => Promise<string>;
};

const defaultDeps: CodexDeps = {
  detect: detectCodex,
  readTranscript: readRollout,
};

export const createCodexHarness = (overrides: Partial<CodexDeps> = {}): HarnessProvider => {
  const deps = { ...defaultDeps, ...overrides };

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
      model_reasoning_summary: params.select({
        label: "Reasoning summary",
        defaultValue: "auto",
        options: [
          { label: "Auto", value: "auto", icon: "Sparkles" },
          { label: "Concise", value: "concise", icon: "AlignLeft" },
          { label: "Detailed", value: "detailed", icon: "FileText" },
          { label: "None", value: "none", icon: "CircleSlash" },
        ],
      }),
    },

    // codex exec is non-interactive: no approval channel, so no Approvals capability.
    capabilities: () => ["ContextUsage"],
    detect: (ctx) => deps.detect(ctx),
    listModels: async (ctx) => ((await deps.detect(ctx)).available ? knownModels : []),

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
