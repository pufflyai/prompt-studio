import type {
  AgentModel,
  HarnessContext,
  HarnessDetectionResult,
  HarnessExit,
  HarnessProvider,
  HarnessResumeInput,
  HarnessSession,
  QuestionResponse,
} from "@pstdio/sdk/extensions";
import { l10n } from "@pstdio/sdk/extensions";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { pollOpencodeQuestionReply } from "./opencode-question-reply-poller";
import { createOpencodeService } from "./opencode-service";
import { pollOpencodeMessages, pollOpencodeUntilIdle } from "./opencode-session-poller";

// --- Model listing ---

const parseModelCandidates = (items: unknown[]) => {
  const ids = items
    .map((item) => {
      if (typeof item === "string") return item.trim();

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        if (typeof record.id === "string") return record.id.trim();
        if (typeof record.model === "string") return record.model.trim();
        if (typeof record.name === "string") return record.name.trim();
      }

      return "";
    })
    .filter((value) => value.includes("/"));

  return [...new Set(ids)];
};

export const parseOpencodeModels = (output: string) => {
  if (!output.trim()) return [];

  try {
    const parsed = JSON.parse(output) as unknown;

    if (Array.isArray(parsed)) return parseModelCandidates(parsed);

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.models)) return parseModelCandidates(record.models);
    }
  } catch {
    // Fall back to line-based parsing
  }

  const ids = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("/"))
    .map((line) => line.split(/\s+/)[0] ?? "")
    .filter((line) => line.includes("/"));

  return [...new Set(ids)];
};

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
    const result = await ctx.process.run({ command: ["opencode", "models"] });
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
): HarnessProvider => {
  const deps = { ...defaultDeps, ...overrides };
  const opencode = createOpencodeService(serviceOverrides);

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

    capabilities: () => ["SessionFork", "ContextUsage", "SessionReattach"],
    detect: (ctx) => deps.detect(ctx),

    listModels: async (ctx) => {
      if (!(await deps.detect(ctx)).available) return [];

      const ids = parseOpencodeModels(await deps.getModelsOutput(ctx));
      return ids.map((id) => ({ id }) satisfies AgentModel);
    },

    start: async (_ctx, input) => {
      const { sessionId, messageComplete } = await opencode.startSession({
        prompt: input.prompt,
        attachments: input.attachments,
        model: input.model,
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
