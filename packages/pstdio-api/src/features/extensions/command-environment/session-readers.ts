import type { ExtensionSessionControlsApi, ExtensionSessionStreamEvent } from "pstdio-api-contracts/extension-kernel";
import { streamSession } from "../../sessions/endpoints/stream-session";
import { toExtensionSessionDetails } from "../../sessions/extension-session";
import { pendingQueuedRequests } from "../../sessions/pending-queued-requests";
import { getQueuedSessionMessages, queuedMessagesFromRequests } from "../../sessions/queued-session-messages";
import { getSessionHistory, readSessionHistorySources } from "../../sessions/session-history";
import type { ExtensionsRouteDeps } from "../deps";
import { createSessionAccess, type SessionApiScope } from "./session-access";

type Readers = Pick<
  ExtensionSessionControlsApi,
  "getConversation" | "getConversationSources" | "getQueuedMessages" | "stream" | "retainResources"
>;

export const createSessionReaders = (deps: ExtensionsRouteDeps, input: SessionApiScope) => {
  const { read, getProjectSession, requireReadableSession } = createSessionAccess(deps, input);
  return {
    getConversation: (id) =>
      read(async () => {
        const session = await requireReadableSession(id);
        const workspace = await read(() => deps.workspaceSessionService.getWorkspaceBySessionId(id));
        const messages = await read(() => getSessionHistory(id, deps));
        const queued = (await getProjectSession(id))
          ? await read(() => getQueuedSessionMessages(deps, input.projectId, id))
          : [];
        return {
          session: toExtensionSessionDetails(session, workspace?.project_id === input.projectId ? workspace.id : null),
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
        if (!(await getProjectSession(id)))
          return {
            messages: [],
            queue: {
              requests: [],
              activeRunStartedAt: null,
              steeringAvailable: false,
              steeringUnavailableReason: "Continue this session on its device.",
            },
          };
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
