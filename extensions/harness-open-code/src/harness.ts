import type {
  HarnessContext,
  HarnessDetectionResult,
  HarnessExit,
  HarnessProvider,
  HarnessResumeInput,
  HarnessSession,
  QuestionResponse,
} from "@pstdio/sdk/extensions";
import { l10n, params } from "@pstdio/sdk/extensions";
import { parseOpencodeModels } from "./models";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { pollOpencodeQuestionReply } from "./opencode-question-reply-poller";
import { createOpencodeService } from "./opencode-service";
import { pollOpencodeMessages, pollOpencodeUntilIdle } from "./opencode-session-poller";

// --- Detection ---

const detectOpencode = async (ctx: HarnessContext): Promise<HarnessDetectionResult> => {
  try {
    const result = await ctx.process.run({ command: ["opencode", "--version"] });
    if (result.exitCode !== 0) return { available: false };
    return { available: true, version: result.stdout.trim() };
  } catch {
    // A missing binary makes process.run throw rather than exit non-zero.
    return { available: false };
  }
};

const readOpencodeModels = async (ctx: HarnessContext) => {
  try {
    const result = await ctx.process.run({ command: ["opencode", "models", "--verbose"] });
    if (result.exitCode !== 0) return "";
    return result.stdout.trim();
  } catch {
    return "";
  }
};

type OpencodeHarnessDeps = {
  detect: typeof detectOpencode;
  getModelsOutput: (ctx: HarnessContext) => Promise<string>;
};

const defaultDeps: OpencodeHarnessDeps = {
  detect: detectOpencode,
  getModelsOutput: readOpencodeModels,
};

const opencodeParams = {
  variant: params.select({
    label: "Thinking",
    defaultValue: "medium",
    options: [
      { label: "None", value: "none", icon: "CircleSlash" },
      { label: "Minimal", value: "minimal", icon: "CircleDot" },
      { label: "Low", value: "low", icon: "Gauge" },
      { label: "Medium", value: "medium", icon: "Brain" },
      { label: "High", value: "high", icon: "Zap" },
      { label: "XHigh", value: "xhigh", icon: "Flame" },
      { label: "Max", value: "max", icon: "Sparkles" },
    ],
  }),
};

const MODEL_CACHE_TTL_MS = 5 * 60 * 1_000;

// --- Session handle ---

const toHarnessSession = (input: {
  agentSessionId: string;
  abortController: AbortController;
  abortSession: () => Promise<void>;
  done: Promise<HarnessExit>;
}): HarnessSession => {
  const { agentSessionId, abortController, abortSession, done } = input;

  return {
    agentSessionId,
    done,
    // Aborting the controller stops the poll loop; the server-side abort is best-effort.
    stop: () => {
      if (abortController.signal.aborted) return;
      void abortSession().catch((error) => {
        console.error(`[opencode] failed to abort session ${agentSessionId}`, error);
      });
      abortController.abort();
    },
    timeoutStrategy: "provider",
  };
};

// --- Factory ---

export const createOpencodeHarness = (
  overrides: Partial<OpencodeHarnessDeps> = {},
  serviceOverrides: Parameters<typeof createOpencodeService>[0] = {},
): Omit<HarnessProvider, "ref"> => {
  const deps = { ...defaultDeps, ...overrides };
  const opencode = createOpencodeService(serviceOverrides);
  let modelCache: { expiresAt: number; value: Promise<ReturnType<typeof parseOpencodeModels>> } | undefined;

  const listModels = async (ctx: HarnessContext) => {
    if (!(await deps.detect(ctx)).available) return [];
    if (modelCache && modelCache.expiresAt > Date.now()) return modelCache.value;

    const value = deps
      .getModelsOutput(ctx)
      .then(parseOpencodeModels)
      .catch((error) => {
        modelCache = undefined;
        ctx.logger.warn(`OpenCode model discovery failed: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      });
    modelCache = { expiresAt: Date.now() + MODEL_CACHE_TTL_MS, value };
    return value;
  };

  const fetchBaselineCount = async (sessionId: string, cwd: string | undefined) => {
    try {
      const existing = await opencode.getSessionMessages(sessionId, cwd);
      return existing.length;
    } catch {
      return 0;
    }
  };

  const resumeQuestionReply = async (input: HarnessResumeInput, questionResponse: QuestionResponse) => {
    const pendingQuestions = await opencode.listPendingQuestions(input.cwd);
    const pendingQuestion = pendingQuestions.find((question) => question.sessionID === input.agentSessionId);
    const messageComplete = pendingQuestion
      ? opencode.replyQuestion(pendingQuestion.id, questionResponse.answers, input.cwd)
      : Promise.reject(new Error("OpenCode pending question request not found."));
    const abortController = new AbortController();
    const done = pollOpencodeQuestionReply({
      loadMessages: opencode.getSessionMessages,
      sessionId: input.agentSessionId,
      cwd: input.cwd,
      events: input.events,
      questionTool: pendingQuestion?.tool,
      questionResponse,
      messageComplete,
      abortSignal: abortController.signal,
    });

    return toHarnessSession({
      agentSessionId: input.agentSessionId,
      abortController,
      abortSession: () => opencode.abortSession(input.agentSessionId, input.cwd),
      done,
    });
  };

  return {
    id: "opencode",
    label: l10n("harness.opencode", "OpenCode"),
    skills: { dir: ".agents/skills" },
    params: opencodeParams,

    capabilities: () => ["SessionFork", "ContextUsage", "SessionReattach"],
    detect: (ctx) => deps.detect(ctx),

    listModels,

    start: async (_ctx, input) => {
      const { sessionId, messageComplete } = await opencode.startSession({
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
        params: input.params,
        cwd: input.cwd,
      });

      const abortController = new AbortController();
      const done = pollOpencodeMessages({
        loadMessages: opencode.getSessionMessages,
        sessionId,
        cwd: input.cwd,
        events: input.events,
        baselineCount: 0,
        messageComplete,
        abortSignal: abortController.signal,
      });

      return toHarnessSession({
        agentSessionId: sessionId,
        abortController,
        abortSession: () => opencode.abortSession(sessionId, input.cwd),
        done,
      });
    },

    resume: async (_ctx, input) => {
      if (input.questionResponse) {
        return resumeQuestionReply(input, input.questionResponse);
      }

      const baselineCount = await fetchBaselineCount(input.agentSessionId, input.cwd);

      const { messageComplete } = opencode.sendSessionMessage({
        sessionId: input.agentSessionId,
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
        params: input.params,
        cwd: input.cwd,
      });
      const abortController = new AbortController();
      const done = pollOpencodeMessages({
        loadMessages: opencode.getSessionMessages,
        sessionId: input.agentSessionId,
        cwd: input.cwd,
        events: input.events,
        baselineCount,
        messageComplete,
        abortSignal: abortController.signal,
      });

      return toHarnessSession({
        agentSessionId: input.agentSessionId,
        abortController,
        abortSession: () => opencode.abortSession(input.agentSessionId, input.cwd),
        done,
      });
    },

    reattach: (_ctx, input) => {
      const abortController = new AbortController();
      const done = pollOpencodeUntilIdle({
        loadMessages: opencode.getSessionMessages,
        sessionId: input.agentSessionId,
        cwd: input.cwd,
        events: input.events,
        abortSignal: abortController.signal,
      });

      return toHarnessSession({
        agentSessionId: input.agentSessionId,
        abortController,
        abortSession: () => opencode.abortSession(input.agentSessionId, input.cwd),
        done,
      });
    },

    getMessages: async (_ctx, input) => {
      const messages = await opencode.getSessionMessages(input.agentSessionId, input.cwd);
      return messages.map(normalizeOpencodeMessage);
    },
  };
};
