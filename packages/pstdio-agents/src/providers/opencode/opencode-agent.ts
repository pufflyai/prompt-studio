import { spawn, spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import type {
  AgentCapability,
  AgentModel,
  AgentService,
  AvailabilityInfo,
  EventStore,
  LaunchInput,
  LaunchResult,
  SessionExport,
  SessionListEntry,
  SessionMessage,
  SessionMessageInput,
  SessionMessagesInput,
  SessionReattachInput,
  SessionStartInput,
} from "../../types";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
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

// --- CLI helpers ---

const runOpencodeCommand = (args: readonly string[]) => {
  const result = spawnSync("opencode", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return result.stdout!.trim();
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
}) => {
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

export const createOpencodeAgent = (
  overrides: Partial<OpencodeAgentDeps> = {},
  serviceOverrides: Parameters<typeof createOpencodeService>[0] = {},
): AgentService => {
  const deps = { ...defaultDeps, ...overrides };
  const opencode = createOpencodeService(serviceOverrides);

  const checkAvailability = (): AvailabilityInfo =>
    deps.isCommandAvailable() ? { type: "INSTALLED" } : { type: "NOT_FOUND" };

  const listModels = (): AgentModel[] => {
    if (!deps.isCommandAvailable()) return [];

    const ids = parseOpencodeModels(deps.getModelsOutput());
    return ids.map((id) => ({ id }));
  };

  const capabilities = (): AgentCapability[] => ["SessionFork", "ContextUsage", "SessionReattach"];

  const getMessages = async (sessionId: string, input?: SessionMessagesInput): Promise<SessionMessage[]> => {
    const cwd = input?.cwd ?? undefined;
    const messages = await opencode.getSessionMessages(sessionId, cwd);
    return messages.map(normalizeOpencodeMessage);
  };

  const fetchBaselineCount = async (sessionId: string, cwd: string | undefined) => {
    try {
      const existing = await opencode.getSessionMessages(sessionId, cwd);
      return existing.length;
    } catch {
      return 0;
    }
  };

  const startSession = async (input: SessionStartInput) => {
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
  };

  const reattachSession = async (input: SessionReattachInput, eventStore: EventStore) => {
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
  };

  const resumeSession = async (input: SessionMessageInput, eventStore: EventStore) => {
    const cwd = input.cwd ?? undefined;
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
  };

  const listSessions = async (): Promise<SessionListEntry[]> => {
    try {
      const output = runOpencodeCommand(["session", "list", "--format", "json"]);
      return JSON.parse(output) as SessionListEntry[];
    } catch {
      return [];
    }
  };

  const exportSession = async (sessionId: string): Promise<SessionExport> => {
    const output = runOpencodeCommand(["export", sessionId]);
    const raw = JSON.parse(output) as { session: SessionListEntry; messages: unknown[] };

    const messages = await getMessages(sessionId);

    return { session: raw.session, messages };
  };

  const launchSession = async (input: LaunchInput): Promise<LaunchResult> => {
    const args: string[] = [];

    if (input.title) {
      args.push("--title", input.title);
    }

    args.push("--prompt", input.prompt);

    if (input.model) {
      args.push("--model", input.model);
    }

    const child = spawn("opencode", args, {
      stdio: "ignore",
      detached: true,
      cwd: input.cwd,
    });

    child.unref();

    return { pid: child.pid };
  };

  return {
    id: "opencode",
    name: "OpenCode",
    capabilities,
    checkAvailability,
    listModels,
    startSession,
    resumeSession,
    reattachSession,
    getMessages,
    listSessions,
    exportSession,
    launchSession,
  };
};
