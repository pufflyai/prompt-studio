import type { MessageOptions, SessionEvent } from "@github/copilot-sdk";
import type { JsonPatch, SessionMessage } from "@pstdio/sdk/extensions";
import type { CopilotClientHandle, CopilotSessionHandle } from "./client";

let sequence = 0;
export const event = (
  type: string,
  data: Record<string, unknown>,
  ephemeral = false,
  extra: { agentId?: string } = {},
) =>
  ({
    id: `e${++sequence}`,
    parentId: null,
    timestamp: "2026-11-15T12:00:00.000Z",
    ephemeral,
    ...extra,
    type,
    data,
  }) as unknown as SessionEvent;

export const eventSink = () => {
  const messages: SessionMessage[] = [];
  return {
    messages,
    getMessages: () => messages,
    push(patch: JsonPatch) {
      const index = Number(patch.path.split("/").at(-1));
      if (patch.op === "remove") messages.splice(index, 1);
      else if (patch.op === "add") messages.splice(index, 0, patch.value as SessionMessage);
      else messages[index] = patch.value as SessionMessage;
    },
  };
};

/** A Copilot runtime that replays `script` after each send. */
export const fakeCopilot = (script: (send: MessageOptions) => SessionEvent[]) => {
  const calls: string[] = [];
  const configs: Record<string, unknown>[] = [];
  const handlers = new Set<(event: SessionEvent) => void>();
  const session: CopilotSessionHandle = {
    sessionId: "copilot-session",
    on(handler: (event: SessionEvent) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    async send(options) {
      calls.push(`send:${options.prompt}`);
      queueMicrotask(() => {
        for (const item of script(options)) for (const handler of handlers) handler(item);
      });
      return "message";
    },
    async abort() {
      calls.push("abort");
      for (const handler of handlers) handler(event("abort", { reason: "user" }));
    },
    async disconnect() {
      calls.push("disconnect");
    },
    async getEvents() {
      return [];
    },
  } as CopilotSessionHandle;
  const client: CopilotClientHandle = {
    start: async () => void calls.push("start"),
    stop: async () => {
      calls.push("stop");
      return [];
    },
    forceStop: async () => void calls.push("forceStop"),
    getStatus: async () => ({ version: "1.0.112" }),
    ping: async () => ({}),
    getAuthStatus: async () => ({ isAuthenticated: true }),
    listModels: async () => [],
    readEvents: async () => [],
    forkSession: async (id, toEventId) => {
      calls.push(`fork:${id}:${toEventId ?? "all"}`);
      return "forked-session";
    },
    getQuota: async () => ({}),
    createSession: async (config) => {
      configs.push(config as never);
      calls.push("create");
      return session;
    },
    resumeSession: async (id, config) => {
      configs.push(config as never);
      calls.push(`resume:${id}`);
      return session;
    },
  };
  return { client, calls, configs, factory: () => client };
};

/** A harness context with in-memory harness state, as the host provides. */
export const harnessContext = (values = new Map<string, unknown>()) =>
  ({
    projectId: "p",
    logger: { warn() {}, info() {}, error() {} },
    state: {
      get: async (key: string) => values.get(key),
      set: async (key: string, value: unknown) => void values.set(key, value),
      delete: async (key: string) => void values.delete(key),
    },
  }) as never;
