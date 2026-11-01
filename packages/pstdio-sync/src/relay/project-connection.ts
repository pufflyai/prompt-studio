import {
  type LiveClientMessage,
  type LiveServerMessage,
  liveServerMessageSchema,
  syncPath,
  syncProtocolHeader,
  syncProtocolVersion,
} from "pstdio-sync-contracts";
import { serviceAddress, serviceUrl } from "./http";

const NativeWebSocket = globalThis.WebSocket as { new (url: string | URL, options?: Bun.WebSocketOptions): WebSocket };

type DocumentChange = { spaceOwner: string | null; documentId: string };

/** One owner of synced documents, such as an extension, on its project's shared live connection. */
export interface ProjectRelayOwner {
  synchronize: (signal: AbortSignal) => Promise<unknown>;
  /** Ends this owner. The project connection stays open for the others. */
  signal: AbortSignal;
  onError?: () => void;
  /** Runs when the connection opens or closes, or a synchronization run of this owner ends. */
  onStatusChange?: () => void;
  /** Also receives notices for documents in the user's personal space. */
  personal?: boolean;
  /** Names the document another device changed, so a run can read only that document. */
  onChanged?: (change: DocumentChange) => void;
  /** Receives another device's live message. */
  onLive?: (message: Extract<LiveServerMessage, { type: "live" }>) => void;
}

type Attached = { owner: ProjectRelayOwner; wake: () => void; settle: () => Promise<void> };

type Project = {
  signal: AbortSignal;
  owners: Set<Attached>;
  claims: Map<string, Set<Attached>>;
  connected: () => boolean;
  /** Aborts when the current socket closes. Owner runs started on it end with it. */
  attemptSignal: () => AbortSignal;
  socket: () => WebSocket | undefined;
  /** Ends the wait before the next reconnect. */
  reconnectNow: () => void;
};

// Each owner runs and retries its own synchronization. A failed run starts the owner's next run on a new signal,
// as a reconnect would, without reconnecting the other owners.
const attachOwner = (project: Project, owner: ProjectRelayOwner) => {
  let dirty = false;
  let running: Promise<void> | undefined;
  let failures = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let ownAttempt = new AbortController();
  let signalFor: AbortSignal | undefined;
  let runSignal = AbortSignal.abort();
  const current = () => {
    if (signalFor !== project.attemptSignal()) {
      signalFor = project.attemptSignal();
      runSignal = AbortSignal.any([signalFor, ownAttempt.signal, owner.signal]);
    }
    return runSignal;
  };
  const drain = async () => {
    const signal = current();
    try {
      while (dirty && project.connected() && !signal.aborted) {
        dirty = false;
        await owner.synchronize(signal);
      }
      failures = 0;
    } catch {
      if (!signal.aborted) {
        owner.onError?.();
        ownAttempt.abort();
        ownAttempt = new AbortController();
        signalFor = undefined;
        retry = setTimeout(wake, Math.min(1000 * 2 ** failures++, 30_000));
      }
    } finally {
      running = undefined;
      owner.onStatusChange?.();
    }
  };
  const wake = () => {
    dirty = true;
    // Renewal keeps connected true while the old attempt drains. The next ready event runs queued work.
    if (project.connected() && !running && !project.attemptSignal().aborted && !owner.signal.aborted) running = drain();
  };
  const attached: Attached = { owner, wake, settle: async () => await running };
  project.owners.add(attached);
  const ended = Promise.withResolvers<void>();
  const end = () => ended.resolve();
  owner.signal.addEventListener("abort", end, { once: true });
  project.signal.addEventListener("abort", end, { once: true });
  if (owner.signal.aborted || project.signal.aborted) end();
  // The caller finishes setting up before the first run.
  if (project.connected()) queueMicrotask(wake);
  return {
    wake,
    retry() {
      clearTimeout(retry);
      project.reconnectNow();
      wake();
    },
    done: ended.promise.then(async () => {
      clearTimeout(retry);
      owner.signal.removeEventListener("abort", end);
      project.signal.removeEventListener("abort", end);
      project.owners.delete(attached);
      for (const [documentId, claimed] of project.claims) {
        claimed.delete(attached);
        if (!claimed.size) project.claims.delete(documentId);
      }
      await running;
    }),
    status: () => ({ connected: project.connected(), busy: dirty || !!running }),
    /** Routes the relay's change notices for this document to this owner. */
    claim(documentId: string) {
      const claimed = project.claims.get(documentId) ?? new Set();
      claimed.add(attached);
      project.claims.set(documentId, claimed);
    },
    /** Sends a live message while connected. Live messages are never stored, so a closed socket drops them. */
    send(message: LiveClientMessage) {
      const socket = project.socket();
      if (!owner.signal.aborted && project.connected() && socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(message));
    },
  };
};

/**
 * One live socket per project for every owner of the project's documents. A change notice wakes only the
 * owners that claimed its document. A notice for an unclaimed document wakes every owner of that space, so an
 * owner still finds documents it does not know yet.
 */
export const createProjectRelayConnection = (input: {
  origin: string;
  projectId: string;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  onError?: () => void;
}) => {
  const address = serviceAddress(input.origin);
  let socket: WebSocket | undefined;
  let connected = false;
  let attempt: AbortController | undefined;
  let attemptSignal = AbortSignal.abort();
  let failures = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let retryDone: (() => void) | undefined;
  let reconnectRequested = false;
  const project: Project = {
    signal: input.signal,
    owners: new Set(),
    claims: new Map(),
    connected: () => connected,
    attemptSignal: () => attemptSignal,
    socket: () => socket,
    reconnectNow() {
      reconnectRequested = true;
      clearTimeout(retry);
      retryDone?.();
    },
  };
  const setConnected = (next: boolean) => {
    if (connected === next) return;
    connected = next;
    for (const attached of project.owners) attached.owner.onStatusChange?.();
  };
  const route = (change: DocumentChange) => {
    const claimed = project.claims.get(change.documentId);
    const targets = claimed?.size
      ? [...claimed]
      : [...project.owners].filter((attached) => !change.spaceOwner || attached.owner.personal);
    for (const attached of targets) {
      attached.owner.onChanged?.(change);
      attached.wake();
    }
  };
  const receive = (data: unknown) => {
    const event = liveServerMessageSchema.parse(JSON.parse(String(data)));
    if (event.type === "ready") {
      if (event.protocolVersion !== syncProtocolVersion) throw new Error("Unsupported sync protocol");
      failures = 0;
      setConnected(true);
      for (const attached of project.owners) attached.wake();
    } else if (event.type === "live") for (const attached of project.owners) attached.owner.onLive?.(event);
    else route(event);
  };
  const access = async () => {
    const cancelled = Promise.withResolvers<never>();
    const abort = () => cancelled.reject(input.signal.reason);
    input.signal.addEventListener("abort", abort, { once: true });
    try {
      return await Promise.race([input.access(), cancelled.promise]);
    } finally {
      input.signal.removeEventListener("abort", abort);
    }
  };
  // One socket for one access grant. Access ends on schedule; renewing a ready connection is not a lost
  // connection, so it keeps its status and reconnects at once, and the runs after the next "ready" catch up.
  const connect = async () => {
    const granted = await access();
    input.signal.throwIfAborted();
    const url = serviceUrl(address, syncPath({ kind: "live", projectId: input.projectId }));
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    let renewal = false;
    const closed = Promise.withResolvers<void>();
    const connection = new NativeWebSocket(url, {
      headers: { [syncProtocolHeader]: String(syncProtocolVersion), authorization: `Bearer ${granted.token}` },
    });
    socket = connection;
    const endAccess = () => {
      const remaining = Date.parse(granted.expiresAt) - Date.now();
      if (remaining > 0) {
        expiry = setTimeout(endAccess, Math.min(remaining, 2_147_483_647));
        return;
      }
      renewal = connected;
      attempt?.abort();
      connection.close();
    };
    endAccess();
    connection.addEventListener("message", (event) => {
      try {
        receive(event.data);
      } catch {
        connection.close();
      }
    });
    connection.addEventListener("error", () => {
      connection.close();
      closed.resolve();
    });
    connection.addEventListener("close", () => closed.resolve());
    await closed.promise;
    return renewal;
  };
  const backoff = async () => {
    if (reconnectRequested) {
      reconnectRequested = false;
      return;
    }
    const waited = Promise.withResolvers<void>();
    retryDone = waited.resolve;
    retry = setTimeout(waited.resolve, Math.min(1000 * 2 ** failures++, 30_000));
    await waited.promise;
    clearTimeout(retry);
    retryDone = undefined;
    reconnectRequested = false;
  };
  const abort = () => {
    clearTimeout(retry);
    clearTimeout(expiry);
    retryDone?.();
    socket?.close();
    attempt?.abort();
  };
  input.signal.addEventListener("abort", abort, { once: true });
  const done = (async () => {
    while (!input.signal.aborted) {
      reconnectRequested = false;
      attempt = new AbortController();
      attemptSignal = AbortSignal.any([input.signal, attempt.signal]);
      const renewal = await connect().catch(() => {
        if (!input.signal.aborted) input.onError?.();
        return false;
      });
      clearTimeout(expiry);
      if (!renewal) setConnected(false);
      attempt.abort();
      await Promise.all([...project.owners].map((attached) => attached.settle()));
      if (input.signal.aborted) break;
      if (!renewal) await backoff();
    }
    input.signal.removeEventListener("abort", abort);
  })();
  return { done, attach: (owner: ProjectRelayOwner) => attachOwner(project, owner) };
};

export type ProjectRelayConnection = ReturnType<typeof createProjectRelayConnection>;
export type ProjectRelayOwnerConnection = ReturnType<typeof attachOwner>;

/** A project connection with a single owner that receives every notice. */
export const createDocumentRelayConnection = (
  input: Omit<ProjectRelayOwner, "personal"> & {
    origin: string;
    projectId: string;
    access: () => Promise<{ token: string; expiresAt: string }>;
  },
) => {
  const project = createProjectRelayConnection(input);
  const connection = project.attach({ ...input, personal: true });
  return { ...connection, done: Promise.all([connection.done, project.done]).then(() => {}) };
};
