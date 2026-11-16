import type { ChildProcess } from "node:child_process";
import type {
  CopilotSession,
  MessageOptions,
  ModelInfo,
  ResumeSessionConfig,
  SessionConfig,
  SessionEvent,
} from "@github/copilot-sdk";
import { CopilotClient } from "@github/copilot-sdk";

export type CopilotSessionHandle = Pick<CopilotSession, "sessionId" | "abort" | "disconnect" | "getEvents"> & {
  on(handler: (event: SessionEvent) => void): () => void;
  send(options: MessageOptions): Promise<string>;
};

/** The part of CopilotClient the harness uses, so tests can substitute a fake runtime. */
export interface CopilotClientHandle {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop(): Promise<void>;
  getStatus(): Promise<{ version: string }>;
  ping(): Promise<unknown>;
  getAuthStatus(): Promise<{ isAuthenticated: boolean; login?: string; statusMessage?: string }>;
  listModels(): Promise<ModelInfo[]>;
  createSession(config: SessionConfig): Promise<CopilotSessionHandle>;
  resumeSession(sessionId: string, config: ResumeSessionConfig): Promise<CopilotSessionHandle>;
  /** A session's saved events, read without resuming it, so reading history never changes the log. */
  readEvents(sessionId: string): Promise<SessionEvent[]>;
  /** Copy a session, keeping events before `toEventId` (all events when omitted). Returns the new id. */
  forkSession(sessionId: string, toEventId?: string): Promise<string>;
  getQuota(): Promise<Record<string, QuotaSnapshot | undefined>>;
}

export type QuotaSnapshot = Awaited<ReturnType<CopilotClient["rpc"]["account"]["getQuota"]>>["quotaSnapshots"][string];

export interface CopilotClientOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export type CopilotClientFactory = (options: CopilotClientOptions) => CopilotClientHandle;

/** Runs `stop` and kills the runtime process if it is still alive afterwards, for example after ignoring SIGTERM. */
export const stopAndKillSurvivor = async <T>(child: ChildProcess | null | undefined, stop: () => Promise<T>) => {
  const result = await stop();
  if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  return result;
};

export const createCopilotClient: CopilotClientFactory = (options) => {
  const client = new CopilotClient({
    logLevel: "error",
    workingDirectory: options.cwd,
    env: { ...process.env, COPILOT_TELEMETRY_DISABLED: "true", ...options.env },
  });
  const stop = client.stop.bind(client);
  return Object.assign(client, {
    // SDK 1.0.34's stop() sends SIGTERM and drops its reference to a runtime that survives it, so a later
    // forceStop() cannot reach that process. Keep the reference and kill a survivor here.
    stop: () => stopAndKillSurvivor((client as unknown as { cliProcess?: ChildProcess | null }).cliProcess, stop),
    readEvents: async (sessionId: string) => {
      const events: SessionEvent[] = [];
      let cursor: string | undefined;
      for (;;) {
        const page = await client.rpc.sessions.readPersistedEvents({ sessionId, cursor, max: 1000 });
        if (page.cursorStatus !== "ok") throw new Error(`Copilot session ${sessionId} changed while it was read.`);
        events.push(...page.events);
        if (!page.hasMore) return events;
        cursor = page.cursor;
      }
    },
    forkSession: async (sessionId: string, toEventId?: string) =>
      (await client.rpc.sessions.fork({ sessionId, ...(toEventId ? { toEventId } : {}) })).sessionId,
    getQuota: async () => (await client.rpc.account.getQuota({})).quotaSnapshots,
  });
};

/** Run one operation against a short-lived runtime. Copilot keeps sessions on disk, so nothing is lost on stop. */
export const withCopilotClient = async <T>(
  factory: CopilotClientFactory,
  options: CopilotClientOptions & { signal?: AbortSignal },
  action: (client: CopilotClientHandle) => Promise<T>,
) => {
  options.signal?.throwIfAborted();
  const client = factory(options);
  const onAbort = () => void client.forceStop().catch(() => {});
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    await client.start();
    return await action(client);
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
    await client
      .stop()
      .catch(() => client.forceStop())
      .catch(() => {});
  }
};
