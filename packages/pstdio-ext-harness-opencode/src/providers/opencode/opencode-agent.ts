import { spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import type {
  ExtensionSetupContext,
  HarnessEventStore,
  HarnessModel,
  HarnessProviderDefinition,
  HarnessResumeResult,
  HarnessSessionMessageInput,
  HarnessSessionMessagesInput,
  HarnessSessionReattachInput,
  HarnessSessionStartInput,
  HarnessSessionStartResult,
  HarnessSpawnedProcess,
} from "@pstdio/sdk/extensions";
import type { SessionMessage } from "pstdio-agents";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { pollOpencodeQuestionReply } from "./opencode-question-reply-poller";
import { createOpencodeService } from "./opencode-service";
import { pollOpencodeMessages, pollOpencodeUntilIdle } from "./opencode-session-poller";

// --- Dependency injection ---

type OpencodeAgentDeps = {
  isCommandAvailable: () => boolean;
  getModelsOutput: () => string;
};

const isOpencodeInstalled = () => {
  const result = spawnSync("opencode", ["--version"], { stdio: "ignore" });
  return result.status === 0;
};

const readOpencodeModels = () => {
  const result = spawnSync("opencode", ["models"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) return "";

  return result.stdout?.trim() ?? "";
};

const parseOpencodeModels = (output: string) => {
  if (!output.trim()) return [];

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

// --- Factory ---

const defaultDeps: OpencodeAgentDeps = {
  isCommandAvailable: isOpencodeInstalled,
  getModelsOutput: readOpencodeModels,
};

const createOpencodeProcess = (input: {
  sessionId: string;
  abortController: AbortController;
  abortSession: () => Promise<void>;
  onExit: Promise<{ code: number | null; signal: string | null }>;
}): HarnessSpawnedProcess => {
  const { sessionId, abortController, abortSession, onExit } = input;

  return {
    sessionId,
    stdin: new PassThrough(),
    kill: () => {
      if (abortController.signal.aborted) return;
      void abortSession().catch((error) => {
        console.error(`[opencode] failed to abort session ${sessionId}`, error);
      });
      abortController.abort();
    },
    onExit,
    timeoutStrategy: "provider" as const,
  };
};

type OpencodeHarnessProvider = HarnessProviderDefinition & {
  listModels(): HarnessModel[];
  getMessages(sessionId: string, input?: HarnessSessionMessagesInput): Promise<SessionMessage[]>;
  startSession(input: HarnessSessionStartInput): Promise<HarnessSessionStartResult>;
  resumeSession(input: HarnessSessionMessageInput, eventStore: HarnessEventStore): Promise<HarnessResumeResult>;
  reattachSession(input: HarnessSessionReattachInput, eventStore: HarnessEventStore): Promise<HarnessResumeResult>;
};

export const createOpencodeHarnessProvider = (
  overrides: Partial<OpencodeAgentDeps> = {},
  serviceOverrides: Parameters<typeof createOpencodeService>[0] = {},
): OpencodeHarnessProvider => {
  const deps = { ...defaultDeps, ...overrides };
  const opencode = createOpencodeService(serviceOverrides);

  const listModels = (): HarnessModel[] => {
    if (!deps.isCommandAvailable()) return [];

    const ids = parseOpencodeModels(deps.getModelsOutput());
    return ids.map((id) => ({ id }));
  };

  function getMessages(sessionId: string, input?: HarnessSessionMessagesInput): Promise<SessionMessage[]>;
  function getMessages(
    _ctx: ExtensionSetupContext,
    sessionId: string,
    input?: HarnessSessionMessagesInput,
  ): Promise<SessionMessage[]>;
  async function getMessages(
    ctxOrSessionId: ExtensionSetupContext | string,
    sessionIdOrInput?: string | HarnessSessionMessagesInput,
    maybeInput?: HarnessSessionMessagesInput,
  ) {
    const sessionId = typeof ctxOrSessionId === "string" ? ctxOrSessionId : (sessionIdOrInput as string);
    const input = typeof ctxOrSessionId === "string" ? (sessionIdOrInput as HarnessSessionMessagesInput) : maybeInput;
    const cwd = input?.cwd ?? undefined;
    const messages = await opencode.getSessionMessages(sessionId, cwd);
    return messages.map(normalizeOpencodeMessage);
  }

  const fetchBaselineCount = async (sessionId: string, cwd: string | undefined) => {
    try {
      const existing = await opencode.getSessionMessages(sessionId, cwd);
      return existing.length;
    } catch {
      return 0;
    }
  };

  function startSession(input: HarnessSessionStartInput): Promise<HarnessSessionStartResult>;
  function startSession(
    _ctx: ExtensionSetupContext,
    input: HarnessSessionStartInput,
  ): Promise<HarnessSessionStartResult>;
  async function startSession(
    ctxOrInput: ExtensionSetupContext | HarnessSessionStartInput,
    maybeInput?: HarnessSessionStartInput,
  ) {
    const input = maybeInput ?? (ctxOrInput as HarnessSessionStartInput);
    const { sessionId, messageComplete } = await opencode.startSession(input);

    if (!input.eventStore) {
      return { sessionId };
    }

    const cwd = input.cwd ?? undefined;
    const abortController = new AbortController();
    const onExit = pollOpencodeMessages({
      loadMessages: opencode.getSessionMessages,
      sessionId,
      cwd,
      eventStore: input.eventStore,
      baselineCount: 0,
      messageComplete,
      abortSignal: abortController.signal,
    });
    const process = createOpencodeProcess({
      sessionId,
      abortController,
      abortSession: () => opencode.abortSession(sessionId, cwd),
      onExit,
    });

    return {
      sessionId,
      process,
    };
  }

  function reattachSession(
    input: HarnessSessionReattachInput,
    eventStore: HarnessEventStore,
  ): Promise<HarnessResumeResult>;
  function reattachSession(
    _ctx: ExtensionSetupContext,
    input: HarnessSessionReattachInput,
    eventStore: HarnessEventStore,
  ): Promise<HarnessResumeResult>;
  async function reattachSession(
    ctxOrInput: ExtensionSetupContext | HarnessSessionReattachInput,
    inputOrEventStore: HarnessSessionReattachInput | HarnessEventStore,
    maybeEventStore?: HarnessEventStore,
  ) {
    const input = "sessionId" in ctxOrInput ? ctxOrInput : (inputOrEventStore as HarnessSessionReattachInput);
    const eventStore = "sessionId" in ctxOrInput ? (inputOrEventStore as HarnessEventStore) : maybeEventStore!;
    const cwd = input.cwd ?? undefined;
    const abortController = new AbortController();
    const onExit = pollOpencodeUntilIdle({
      loadMessages: opencode.getSessionMessages,
      sessionId: input.sessionId,
      cwd,
      eventStore,
      abortSignal: abortController.signal,
    });
    const process = createOpencodeProcess({
      sessionId: input.sessionId,
      abortController,
      abortSession: () => opencode.abortSession(input.sessionId, cwd),
      onExit,
    });

    return {
      process,
    };
  }

  function resumeSession(
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
  ): Promise<HarnessResumeResult>;
  function resumeSession(
    _ctx: ExtensionSetupContext,
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
  ): Promise<HarnessResumeResult>;
  async function resumeSession(
    ctxOrInput: ExtensionSetupContext | HarnessSessionMessageInput,
    inputOrEventStore: HarnessSessionMessageInput | HarnessEventStore,
    maybeEventStore?: HarnessEventStore,
  ) {
    const input = "sessionId" in ctxOrInput ? ctxOrInput : (inputOrEventStore as HarnessSessionMessageInput);
    const eventStore = "sessionId" in ctxOrInput ? (inputOrEventStore as HarnessEventStore) : maybeEventStore!;
    const cwd = input.cwd ?? undefined;

    if (input.questionResponse) {
      const pendingQuestions = await opencode.listPendingQuestions(cwd);
      const pendingQuestion = pendingQuestions.find((question) => question.sessionID === input.sessionId);
      const messageComplete = pendingQuestion
        ? opencode.replyQuestion(pendingQuestion.id, input.questionResponse.answers, cwd)
        : Promise.reject(new Error("OpenCode pending question request not found."));
      const abortController = new AbortController();
      const onExit = pollOpencodeQuestionReply({
        loadMessages: opencode.getSessionMessages,
        sessionId: input.sessionId,
        cwd,
        eventStore,
        questionTool: pendingQuestion?.tool,
        questionResponse: input.questionResponse,
        messageComplete,
        abortSignal: abortController.signal,
      });
      const process = createOpencodeProcess({
        sessionId: input.sessionId,
        abortController,
        abortSession: () => opencode.abortSession(input.sessionId, cwd),
        onExit,
      });

      return {
        process,
      };
    }

    const baselineCount = await fetchBaselineCount(input.sessionId, cwd);

    const { messageComplete } = opencode.sendSessionMessage(input);
    const abortController = new AbortController();
    const onExit = pollOpencodeMessages({
      loadMessages: opencode.getSessionMessages,
      sessionId: input.sessionId,
      cwd,
      eventStore,
      baselineCount,
      messageComplete,
      abortSignal: abortController.signal,
    });
    const process = createOpencodeProcess({
      sessionId: input.sessionId,
      abortController,
      abortSession: () => opencode.abortSession(input.sessionId, cwd),
      onExit,
    });

    return {
      process,
    };
  }

  return {
    id: "pstdio.harness.opencode",
    label: "OpenCode",
    async detect() {
      return deps.isCommandAvailable()
        ? { available: true }
        : { available: false, reason: "OpenCode executable was not found." };
    },
    listModels,
    async start(_ctx, input) {
      const result = await startSession({
        prompt: input.prompt ?? "",
        cwd: input.workspacePath,
        env: { PSTDIO_SESSION_ID: input.sessionId },
      });

      return {
        runId: result.sessionId,
        onExit: result.process?.onExit,
      };
    },
    startSession,
    resumeSession,
    reattachSession,
    getMessages,
  };
};
