import { sessionQueuedMessagesResponseSchema } from "pstdio-api-contracts";
import type { ExtensionSessionControlsApi, ExtensionSessionStreamEvent } from "pstdio-api-contracts/extension-kernel";
import { streamSession } from "../../sessions/endpoints/stream-session";
import { toExtensionSessionDetails } from "../../sessions/extension-session";
import { pendingQueuedRequests } from "../../sessions/pending-queued-requests";
import { getQueuedSessionMessages, queuedMessagesFromRequests } from "../../sessions/queued-session-messages";
import { getSessionHistory, readSessionHistorySources } from "../../sessions/session-history";
import type { ExtensionsRouteDeps } from "../deps";
import { createSessionAccess, type SessionApiScope } from "./session-access";
import { createRemoteSessionAccess } from "./session-remote";

type Readers = Pick<
  ExtensionSessionControlsApi,
  | "getExecutionState"
  | "getConversation"
  | "getConversationSources"
  | "getQueuedMessages"
  | "stream"
  | "retainResources"
>;

export const createSessionReaders = (deps: ExtensionsRouteDeps, input: SessionApiScope) => {
  const { read, getProjectSession, requireReadableSession } = createSessionAccess(deps, input);
  const remote = createRemoteSessionAccess(deps, input);
  const remoteQueue = async (id: string) => {
    try {
      const forwarded = await remote(id, { type: "session.queuedMessages", id }, sessionQueuedMessagesResponseSchema);
      if (forwarded) return forwarded.value;
    } catch (error) {
      input.signal?.throwIfAborted();
      const shared = await read(() => deps.personalHistoryService.queuedMessages(id, input.projectId));
      if (shared) return shared;
      throw error;
    }
    throw new Error(`Session not found: ${id}`);
  };
  return {
    getExecutionState: (id) =>
      read(async () => {
        if (await getProjectSession(id)) return { kind: "local" as const, available: true };
        const session = await deps.personalHistoryService.getSession(id, input.projectId);
        if (!session) throw new Error(`Session not found: ${id}`);
        const status = await deps.accountService.status();
        const devices =
          status.login?.accountId === session.device.ownerId ? await deps.accountService.devices().catch(() => []) : [];
        return {
          kind: "remote" as const,
          available: devices.some((device) => device.id === session.device.id && device.online),
          device: { id: session.device.id, name: session.device.name },
        };
      }),
    getConversation: (id) =>
      read(async () => {
        const session = await requireReadableSession(id);
        const local = await read(() => getProjectSession(id));
        const workspace = local ? await read(() => deps.workspaceSessionService.getWorkspaceBySessionId(id)) : null;
        let workspaceId = workspace?.project_id === input.projectId ? workspace.id : null;
        if (!local && "workspace_id" in session) workspaceId = session.workspace_id;
        const messages = await read(() => getSessionHistory(id, deps));
        const queued = (await getProjectSession(id))
          ? await read(() => getQueuedSessionMessages(deps, input.projectId, id))
          : (await remoteQueue(id)).messages;
        return {
          session: toExtensionSessionDetails(session, workspaceId),
          messages: [...messages, ...queued],
        };
      }),
    getConversationSources: (id) =>
      read(async () => {
        await requireReadableSession(id);
        if (await getProjectSession(id)) return (await read(() => readSessionHistorySources(id, deps))).sources;
        return {
          checkpoint: await read(() => deps.personalHistoryService.messages(id, input.projectId)),
          native: null,
          checkpointError: null,
          nativeError: null,
        };
      }),
    getQueuedMessages: (id) =>
      read(async () => {
        await requireReadableSession(id);
        if (!(await getProjectSession(id))) {
          return remoteQueue(id);
        }
        const queue = await read(() => pendingQueuedRequests(deps, id));
        const messages = await read(() => queuedMessagesFromRequests(deps, input.projectId, id, queue.requests));
        return { messages, queue };
      }),
    stream: async (id, onEvent, options) => {
      const signals = [input.signal, options?.signal].filter((signal): signal is AbortSignal => Boolean(signal));
      const controller = new AbortController();
      const signal = AbortSignal.any([...signals, controller.signal]);
      signal.throwIfAborted();
      await requireReadableSession(id);
      signal.throwIfAborted();
      input.scope?.register(() => controller.abort());
      try {
        await streamSession(id, deps, {
          get aborted() {
            return signal.aborted;
          },
          onAbort: (listener) => {
            if (signal.aborted) listener();
            else signal.addEventListener("abort", listener, { once: true });
          },
          sleep: (ms) =>
            new Promise<void>((resolve) => {
              const finish = () => {
                clearTimeout(timer);
                signal.removeEventListener("abort", finish);
                resolve();
              };
              const timer = setTimeout(finish, ms);
              if (signal.aborted) finish();
              else signal.addEventListener("abort", finish, { once: true });
            }),
          write: async (event, data) => {
            if (!signal.aborted) await onEvent({ event, data } as ExtensionSessionStreamEvent);
          },
        });
      } finally {
        controller.abort();
      }
    },
    retainResources: async (id) => {
      await requireReadableSession(id);
      // Reading another device's history must never attach a local harness resource owner.
      if (!(await getProjectSession(id))) return { close() {} };
      const release = deps.harnessRegistry.retainSession(id);
      const close = () => {
        input.signal?.removeEventListener("abort", close);
        release();
      };
      if (input.signal?.aborted) close();
      else input.signal?.addEventListener("abort", close, { once: true });
      input.scope?.register(close);
      return { close };
    },
  } satisfies Readers;
};
