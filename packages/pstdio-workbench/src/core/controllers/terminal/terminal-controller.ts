import type { TerminalViewBinding } from "@pstdio/sdk/api";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type {
  WorkbenchTerminalController,
  WorkbenchTerminalSessionAdapter,
  WorkbenchTerminalSessionModel,
  WorkbenchTerminalSessionOpener,
  WorkbenchTerminalSessionRequest,
  WorkbenchTerminalState,
} from "./terminal-controller-types";
import { createTerminalSessionCleanup } from "./terminal-session-cleanup";

export type * from "./terminal-controller-types";

const DEFAULT_SESSION_TITLE = "Terminal";
const SESSION_HISTORY_LIMIT = 200;

const releaseTerminalAdapter = (
  sessionId: string,
  adapters: Map<string, WorkbenchTerminalSessionAdapter>,
  adapterDisposers: Map<string, Array<() => void>>,
  dataSubscribers: Map<string, Set<(chunk: Uint8Array) => void>>,
) => {
  adapters.delete(sessionId);
  dataSubscribers.delete(sessionId);
  const disposers = adapterDisposers.get(sessionId) ?? [];
  adapterDisposers.delete(sessionId);
  const errors: unknown[] = [];
  for (const dispose of disposers) {
    try {
      dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, "Terminal subscription cleanup failed");
};

const bindingKey = (bindingId: string, ownerId?: string) =>
  ownerId ? JSON.stringify([ownerId, bindingId]) : bindingId;

export const createWorkbenchTerminalController = (): WorkbenchTerminalController => {
  const store = createWorkbenchStore<WorkbenchTerminalState>({
    name: "workbench.terminal",
    initialState: { sessionsById: {} },
  });

  let opener: WorkbenchTerminalSessionOpener | null = null;
  let disposed = false;
  const openings = new Map<
    Promise<{ sessionId: string }>,
    { ownerId?: string; bindingId?: string; controller: AbortController }
  >();
  const ownershipListeners = new Set<() => void>();
  const notifyOwnership = () => {
    for (const listener of ownershipListeners) runWorkbenchEffect("terminal ownership", listener);
  };
  const sessionOwners = new Map<string, string>();
  const adapters = new Map<string, WorkbenchTerminalSessionAdapter>();
  const adapterDisposers = new Map<string, Array<() => void>>();
  const dataHistory = new Map<string, Uint8Array[]>();
  const dataSubscribers = new Map<string, Set<(chunk: Uint8Array) => void>>();
  const sessionIdByBindingId = new Map<string, string>();
  const bindingIdBySessionId = new Map<string, string>();
  const pendingSessionByBindingId = new Map<string, Promise<{ sessionId: string }>>();

  const patchSession = (sessionId: string, patch: Partial<WorkbenchTerminalSessionModel>, action: string) => {
    const snapshot = store.getState();
    const session = snapshot.sessionsById[sessionId];
    if (!session) return;
    store.setState(
      { sessionsById: { ...snapshot.sessionsById, [sessionId]: { ...session, ...patch } } },
      false,
      action,
    );
  };

  const requireAdapter = (sessionId: string) => {
    const adapter = adapters.get(sessionId);
    if (!adapter) throw new Error(`Unknown terminal session: ${sessionId}`);
    return adapter;
  };

  const releaseAdapter = (id: string) => releaseTerminalAdapter(id, adapters, adapterDisposers, dataSubscribers);

  const cleanupSession = (sessionId: string) => {
    try {
      releaseAdapter(sessionId);
    } finally {
      sessionOwners.delete(sessionId);
      dataHistory.delete(sessionId);
      const bindingId = bindingIdBySessionId.get(sessionId);
      bindingIdBySessionId.delete(sessionId);
      if (bindingId && sessionIdByBindingId.get(bindingId) === sessionId) sessionIdByBindingId.delete(bindingId);
      notifyOwnership();
    }
  };

  const publishData = (sessionId: string, chunk: Uint8Array) => {
    const history = dataHistory.get(sessionId);
    if (!history) return;
    const snapshot = new Uint8Array(chunk);
    history.push(snapshot);
    if (history.length > SESSION_HISTORY_LIMIT) history.shift();
    for (const subscriber of dataSubscribers.get(sessionId) ?? []) subscriber(snapshot);
  };

  const cleanup = createTerminalSessionCleanup({
    adapters,
    sessions: () => Object.values(store.getState().sessionsById),
    patchKilled: (id) => patchSession(id, { status: "killed" }, "killTerminalSession"),
    cleanup: cleanupSession,
  });
  const { kill } = cleanup;

  const killBinding = async (placementId: string, ownerId?: string) => {
    const bindingId = bindingKey(placementId, ownerId);
    for (const admission of openings.values()) {
      if (admission.bindingId === bindingId) admission.controller.abort();
    }
    pendingSessionByBindingId.delete(bindingId);
    const sessionId = sessionIdByBindingId.get(bindingId);
    if (sessionId) {
      await kill({ sessionId });
      return;
    }
  };

  const open = async (input: {
    bindingId?: string;
    ownerId?: string;
    view?: TerminalViewBinding;
    request: WorkbenchTerminalSessionRequest;
    title?: string;
  }) => {
    if (disposed || !opener) throw new Error("Terminal sessions are not available in this workbench host.");

    const bindingId = input.bindingId ? bindingKey(input.bindingId, input.ownerId) : undefined;
    if (bindingId) {
      const sessionId = sessionIdByBindingId.get(bindingId);
      if (sessionId) return { sessionId };
      const pending = pendingSessionByBindingId.get(bindingId);
      if (pending) return await pending;
    }

    const controller = new AbortController();
    const openSession = (async () => {
      const adapter = await opener(input.request, input.view, controller.signal);
      if (disposed || controller.signal.aborted) {
        await adapter.kill();
        throw new Error("Terminal admission was cancelled");
      }
      if (input.ownerId) sessionOwners.set(adapter.id, input.ownerId);
      adapters.set(adapter.id, adapter);
      dataHistory.set(adapter.id, []);
      dataSubscribers.set(adapter.id, new Set());
      if (bindingId) {
        sessionIdByBindingId.set(bindingId, adapter.id);
        bindingIdBySessionId.set(adapter.id, bindingId);
      }

      const snapshot = store.getState();
      store.setState(
        {
          sessionsById: {
            ...snapshot.sessionsById,
            [adapter.id]: { id: adapter.id, title: input.title ?? DEFAULT_SESSION_TITLE, status: "running" },
          },
        },
        false,
        "openTerminalSession",
      );

      // Session state must exist before any transport subscription replays queued data or exit.
      const disposers: Array<() => void> = [];
      adapterDisposers.set(adapter.id, disposers);
      const retain = (unsubscribe: (() => void) | undefined) => {
        if (!unsubscribe) return;
        if (adapters.get(adapter.id) === adapter) disposers.push(unsubscribe);
        else unsubscribe();
      };
      retain(adapter.onData((chunk) => publishData(adapter.id, chunk)));
      retain(adapter.onTitle?.((title) => patchSession(adapter.id, { title }, "terminalSessionTitleChanged")));
      retain(
        adapter.onExit((exit) => {
          patchSession(adapter.id, { status: "exited", exit }, "terminalSessionExited");
          // The presentation retains its bounded history and exit; the live adapter is finished.
          if (bindingId) releaseAdapter(adapter.id);
          else cleanupSession(adapter.id);
        }),
      );

      return { sessionId: adapter.id };
    })();

    openings.set(openSession, { ownerId: input.ownerId, bindingId, controller });
    if (bindingId) pendingSessionByBindingId.set(bindingId, openSession);
    notifyOwnership();
    try {
      return await openSession;
    } finally {
      openings.delete(openSession);
      if (bindingId && pendingSessionByBindingId.get(bindingId) === openSession) {
        pendingSessionByBindingId.delete(bindingId);
      }
      notifyOwnership();
    }
  };

  return {
    store,

    isAvailable: () => !disposed && opener !== null,

    setSessionOpener(next) {
      opener = next;
    },

    open,

    write(input) {
      if (adapters.has(input.sessionId) || !store.getState().sessionsById[input.sessionId])
        requireAdapter(input.sessionId).write(input.data);
    },

    resize(input) {
      if (adapters.has(input.sessionId) || !store.getState().sessionsById[input.sessionId])
        requireAdapter(input.sessionId).resize(input.cols, input.rows);
    },

    kill,

    killBinding,

    onDidChangeOwnership(listener) {
      if (disposed) return () => {};
      ownershipListeners.add(listener);
      return () => {
        ownershipListeners.delete(listener);
      };
    },

    hasOwner(ownerId) {
      return (
        [...sessionOwners.values()].includes(ownerId) ||
        [...openings.values()].some((entry) => entry.ownerId === ownerId)
      );
    },

    async killOwner(ownerId) {
      for (const admission of openings.values()) {
        if (admission.ownerId === ownerId) admission.controller.abort();
      }
      const results = await Promise.allSettled(
        [...sessionOwners].filter(([, owner]) => owner === ownerId).map(([sessionId]) => kill({ sessionId })),
      );
      const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "Terminal owner cleanup failed");
    },

    subscribe(sessionId, sink) {
      const adapter = adapters.get(sessionId);
      const session = store.getState().sessionsById[sessionId];
      if (!session) requireAdapter(sessionId);
      const unsubscribes: Array<(() => void) | undefined> = [];
      if (sink.onData) {
        const onData = sink.onData;
        const subscribers = dataSubscribers.get(sessionId);
        subscribers?.add(onData);
        unsubscribes.push(() => subscribers?.delete(onData));
        for (const chunk of dataHistory.get(sessionId) ?? []) onData(chunk);
      }
      if (adapter) {
        unsubscribes.push(
          sink.onExit ? adapter.onExit(sink.onExit) : undefined,
          sink.onError ? adapter.onError(sink.onError) : undefined,
        );
      } else if (session?.exit) sink.onExit?.(session.exit);
      return () => {
        for (const unsubscribe of unsubscribes) unsubscribe?.();
      };
    },

    getSession(sessionId) {
      return store.getState().sessionsById[sessionId];
    },

    listSessions() {
      return Object.values(store.getState().sessionsById);
    },

    dispose() {
      disposed = true;
      for (const admission of openings.values()) admission.controller.abort();
      return cleanup.dispose();
    },
  };
};
