import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

// Structural copies of the renderer-side terminal contract (`@pstdio/ui/terminal`
// and `@pstdio/sdk` mirror the same shapes). Core owns its contracts, so these are
// declared here instead of importing UI package types — the React layer bridges the two.
export interface WorkbenchTerminalSessionRequest {
  command?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols: number;
  rows: number;
}

export interface WorkbenchTerminalSessionExit {
  code: number | null;
  signal: string | null;
}

export interface WorkbenchTerminalSessionError {
  message: string;
}

export interface WorkbenchTerminalSessionAdapter {
  readonly id: string;
  write(data: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): Promise<void> | void;
  onData(handler: (chunk: Uint8Array) => void): () => void;
  /** Foreground process name updates, when the opener can report them (real PTYs). */
  onTitle?(handler: (title: string) => void): () => void;
  onExit(handler: (exit: WorkbenchTerminalSessionExit) => void): () => void;
  onError(handler: (error: WorkbenchTerminalSessionError) => void): () => void;
}

// Host-injected session factory. Production hosts back this with a PTY transport;
// the testbench and stories inject a deterministic scripted opener.
export type WorkbenchTerminalSessionOpener = (
  request: WorkbenchTerminalSessionRequest,
) => Promise<WorkbenchTerminalSessionAdapter>;

export type WorkbenchTerminalSessionStatus = "running" | "exited" | "killed";

export interface WorkbenchTerminalSessionModel {
  id: string;
  title: string;
  status: WorkbenchTerminalSessionStatus;
  exit?: WorkbenchTerminalSessionExit;
}

export interface WorkbenchTerminalState {
  sessionsById: Record<string, WorkbenchTerminalSessionModel>;
}

export interface WorkbenchTerminalSessionSink {
  onData?(chunk: Uint8Array): void;
  onExit?(exit: WorkbenchTerminalSessionExit): void;
  onError?(error: WorkbenchTerminalSessionError): void;
}

export interface WorkbenchTerminalController {
  store: WorkbenchStore<WorkbenchTerminalState>;
  /** True once the host injected a session opener. */
  isAvailable(): boolean;
  setSessionOpener(opener: WorkbenchTerminalSessionOpener | null): void;
  /** Opens a session; the live adapter stays host-side and only the id is returned. */
  open(input: {
    bindingId?: string;
    request: WorkbenchTerminalSessionRequest;
    title?: string;
  }): Promise<{ sessionId: string }>;
  write(input: { sessionId: string; data: string | Uint8Array }): void;
  resize(input: { sessionId: string; cols: number; rows: number }): void;
  kill(input: { sessionId: string; signal?: string }): Promise<void>;
  killBinding(bindingId: string): Promise<void>;
  subscribe(sessionId: string, sink: WorkbenchTerminalSessionSink): () => void;
  getSession(sessionId: string): WorkbenchTerminalSessionModel | undefined;
  listSessions(): WorkbenchTerminalSessionModel[];
  /** Kills every live session. Called when the owning workbench is torn down. */
  dispose(): Promise<void>;
}

const DEFAULT_SESSION_TITLE = "Terminal";
const SESSION_HISTORY_LIMIT = 200;

export const createWorkbenchTerminalController = (): WorkbenchTerminalController => {
  const store = createWorkbenchStore<WorkbenchTerminalState>({
    name: "workbench.terminal",
    initialState: { sessionsById: {} },
  });

  let opener: WorkbenchTerminalSessionOpener | null = null;
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

  const cleanupSession = (sessionId: string) => {
    adapters.delete(sessionId);
    dataHistory.delete(sessionId);
    dataSubscribers.delete(sessionId);
    const bindingId = bindingIdBySessionId.get(sessionId);
    bindingIdBySessionId.delete(sessionId);
    if (bindingId && sessionIdByBindingId.get(bindingId) === sessionId) sessionIdByBindingId.delete(bindingId);
    const disposers = adapterDisposers.get(sessionId) ?? [];
    adapterDisposers.delete(sessionId);
    for (const dispose of disposers) dispose();
  };

  const publishData = (sessionId: string, chunk: Uint8Array) => {
    const history = dataHistory.get(sessionId);
    if (!history) return;
    const snapshot = new Uint8Array(chunk);
    history.push(snapshot);
    if (history.length > SESSION_HISTORY_LIMIT) history.shift();
    for (const subscriber of dataSubscribers.get(sessionId) ?? []) subscriber(snapshot);
  };

  const kill = async (input: { sessionId: string; signal?: string }) => {
    const adapter = requireAdapter(input.sessionId);
    await adapter.kill(input.signal);
    patchSession(input.sessionId, { status: "killed" }, "killTerminalSession");
    cleanupSession(input.sessionId);
  };

  const killBinding = async (bindingId: string) => {
    const sessionId = sessionIdByBindingId.get(bindingId);
    if (sessionId && adapters.has(sessionId)) {
      await kill({ sessionId });
      return;
    }

    const pending = pendingSessionByBindingId.get(bindingId);
    if (!pending) return;
    const opened = await pending.catch(() => undefined);
    if (opened && adapters.has(opened.sessionId)) await kill({ sessionId: opened.sessionId });
  };

  const open = async (input: { bindingId?: string; request: WorkbenchTerminalSessionRequest; title?: string }) => {
    if (!opener) throw new Error("Terminal sessions are not available in this workbench host.");

    if (input.bindingId) {
      const sessionId = sessionIdByBindingId.get(input.bindingId);
      if (sessionId && adapters.has(sessionId)) return { sessionId };
      const pending = pendingSessionByBindingId.get(input.bindingId);
      if (pending) return await pending;
    }

    const openSession = (async () => {
      const adapter = await opener(input.request);
      adapters.set(adapter.id, adapter);
      dataHistory.set(adapter.id, []);
      dataSubscribers.set(adapter.id, new Set());
      if (input.bindingId) {
        sessionIdByBindingId.set(input.bindingId, adapter.id);
        bindingIdBySessionId.set(adapter.id, input.bindingId);
      }

      const disposers = [adapter.onData((chunk) => publishData(adapter.id, chunk))];
      const unsubscribeTitle = adapter.onTitle?.((title) =>
        patchSession(adapter.id, { title }, "terminalSessionTitleChanged"),
      );
      if (unsubscribeTitle) disposers.push(unsubscribeTitle);
      disposers.push(
        adapter.onExit((exit) => {
          const session = store.getState().sessionsById[adapter.id];
          if (session?.status === "running") {
            patchSession(adapter.id, { status: "exited", exit }, "terminalSessionExited");
          }
          cleanupSession(adapter.id);
        }),
      );
      adapterDisposers.set(adapter.id, disposers);

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

      return { sessionId: adapter.id };
    })();

    if (input.bindingId) pendingSessionByBindingId.set(input.bindingId, openSession);
    try {
      return await openSession;
    } finally {
      if (input.bindingId && pendingSessionByBindingId.get(input.bindingId) === openSession) {
        pendingSessionByBindingId.delete(input.bindingId);
      }
    }
  };

  return {
    store,

    isAvailable: () => opener !== null,

    setSessionOpener(next) {
      opener = next;
    },

    open,

    write(input) {
      requireAdapter(input.sessionId).write(input.data);
    },

    resize(input) {
      requireAdapter(input.sessionId).resize(input.cols, input.rows);
    },

    kill,

    killBinding,

    subscribe(sessionId, sink) {
      const adapter = requireAdapter(sessionId);
      const unsubscribes: Array<(() => void) | undefined> = [];
      if (sink.onData) {
        const onData = sink.onData;
        const subscribers = dataSubscribers.get(sessionId);
        subscribers?.add(onData);
        unsubscribes.push(() => subscribers?.delete(onData));
        for (const chunk of dataHistory.get(sessionId) ?? []) onData(chunk);
      }
      unsubscribes.push(
        sink.onExit ? adapter.onExit(sink.onExit) : undefined,
        sink.onError ? adapter.onError(sink.onError) : undefined,
      );
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

    async dispose() {
      const running = Object.values(store.getState().sessionsById).filter((session) => session.status === "running");
      await Promise.all(running.map((session) => kill({ sessionId: session.id })));
      for (const session of Object.values(store.getState().sessionsById)) cleanupSession(session.id);
      adapters.clear();
    },
  };
};
