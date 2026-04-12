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
import { normalizeErrorPart } from "../normalized-error";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import { createOpencodeService, isTransportTimeout } from "./opencode-service";
import type { OpencodeSessionMessage } from "./opencode-types";

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

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "OpenCode session failed.";
};

// --- Factory ---

const defaultDeps: OpencodeAgentDeps = {
  isCommandAvailable: isOpencodeInstalled,
  getModelsOutput: readOpencodeModels,
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

  const pollMessages = async (
    sessionId: string,
    cwd: string | undefined,
    eventStore: EventStore,
    messageComplete: Promise<void>,
  ) => {
    let lastSnapshot = "";
    let latestMessages: SessionMessage[] = [];
    let done = false;
    let failed = false;
    let timedOut = false;
    let failureMessage = "";

    messageComplete
      .then(() => {
        done = true;
      })
      .catch((error: unknown) => {
        done = true;
        if (isTransportTimeout(error)) {
          timedOut = true;
        } else {
          failed = true;
          failureMessage = toErrorMessage(error);
        }
      });

    while (!done) {
      await new Promise((r) => setTimeout(r, 1000));

      try {
        const messages = await opencode.getSessionMessages(sessionId, cwd);
        const normalized = messages.map(normalizeOpencodeMessage);
        const snapshot = JSON.stringify(normalized);

        if (snapshot !== lastSnapshot) {
          eventStore.push({ op: "replace", path: "/messages", value: normalized });
          lastSnapshot = snapshot;
          latestMessages = normalized;
        }
      } catch {
        // Ignore transient fetch errors
      }
    }

    // Final fetch after prompt completes
    try {
      const messages = await opencode.getSessionMessages(sessionId, cwd);
      const normalized = messages.map(normalizeOpencodeMessage);
      eventStore.push({ op: "replace", path: "/messages", value: normalized });
      latestMessages = normalized;
    } catch {
      // Ignore
    }

    if (failed) {
      const failurePart = normalizeErrorPart({ message: failureMessage });
      const normalizedFailureMessage: SessionMessage = {
        id: `opencode-error-${sessionId}-${latestMessages.length}`,
        role: "system",
        parts: [failurePart],
        index: latestMessages.length,
      };

      const nextMessages = [...latestMessages, normalizedFailureMessage];
      eventStore.push({ op: "replace", path: "/messages", value: nextMessages });
    }

    if (timedOut) {
      eventStore.push({ op: "replace", path: "/status", value: "disconnected" });
      return { code: null as number | null, signal: "TIMEOUT" as string | null };
    }

    const status = failed ? "failed" : "completed";
    eventStore.push({ op: "replace", path: "/status", value: status });

    return { code: failed ? 1 : (0 as number | null), signal: null as string | null };
  };

  const startSession = async (input: SessionStartInput) => {
    const { sessionId, messageComplete } = await opencode.startSession(input);

    if (!input.eventStore) {
      return { sessionId };
    }

    const cwd = input.cwd ?? undefined;
    const onExit = pollMessages(sessionId, cwd, input.eventStore, messageComplete);

    return {
      sessionId,
      process: {
        sessionId,
        stdin: new PassThrough(),
        kill: () => {},
        onExit,
        timeoutStrategy: "provider" as const,
      },
    };
  };

  const isTurnInFlight = (rawMessages: OpencodeSessionMessage[]) => {
    const tail = rawMessages.at(-1);
    if (!tail || !("info" in tail) || tail.info?.role !== "assistant") return false;
    return tail.info?.time?.completed === undefined;
  };

  const pollUntilIdle = async (sessionId: string, cwd: string | undefined, eventStore: EventStore) => {
    let lastSnapshot = "";

    while (true) {
      let raw: OpencodeSessionMessage[] = [];
      try {
        raw = await opencode.getSessionMessages(sessionId, cwd);
      } catch {
        // Transient fetch error — keep looping
      }

      const normalized = raw.map(normalizeOpencodeMessage);
      const snapshot = JSON.stringify(normalized);
      if (snapshot !== lastSnapshot) {
        eventStore.push({ op: "replace", path: "/messages", value: normalized });
        lastSnapshot = snapshot;
      }

      if (!isTurnInFlight(raw)) break;

      await new Promise((r) => setTimeout(r, 1000));
    }

    eventStore.push({ op: "replace", path: "/status", value: "completed" });
    return { code: 0 as number | null, signal: null as string | null };
  };

  const reattachSession = async (input: SessionReattachInput, eventStore: EventStore) => {
    const cwd = input.cwd ?? undefined;
    const onExit = pollUntilIdle(input.sessionId, cwd, eventStore);

    return {
      process: {
        sessionId: input.sessionId,
        stdin: new PassThrough(),
        kill: () => {},
        onExit,
        timeoutStrategy: "provider" as const,
      },
    };
  };

  const resumeSession = async (input: SessionMessageInput, eventStore: EventStore) => {
    const { messageComplete } = opencode.sendSessionMessage(input);

    const cwd = input.cwd ?? undefined;
    const onExit = pollMessages(input.sessionId, cwd, eventStore, messageComplete);

    return {
      process: {
        sessionId: input.sessionId,
        stdin: new PassThrough(),
        kill: () => {},
        onExit,
        timeoutStrategy: "provider" as const,
      },
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
