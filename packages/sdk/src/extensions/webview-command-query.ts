import { hashKey } from "@tanstack/query-core";
import type {
  RendererEventReference,
  WebviewCommandQueryDefinition,
  WebviewCommandQueryEvent,
  WebviewCommandQuerySnapshot,
  WebviewCommandsExecuteParams,
} from "pstdio-api-contracts/extension-kernel";
import { resolveEventReferenceId } from "./event-reference";
import type { GuestHost } from "./guest-host";
import { runQueryCleanup } from "./query-cleanup";
import type { QueryDependency } from "./query-dependency";
import type { ScopedQuerySnapshot } from "./scoped-query";
import { shareQueryValue } from "./share-query-value";
import { createWebviewQueryRequests } from "./webview-query-requests";

export interface WebviewCommandQueryOptions extends Pick<WebviewCommandsExecuteParams, "workspaceId" | "resource"> {
  events?: readonly RendererEventReference[];
  dependency?: QueryDependency;
}

/** Read-only projection of a host-owned finite source; mutations publish their declared source events. */
export interface WebviewCommandQuery<T> {
  getSnapshot(): ScopedQuerySnapshot<T>;
  subscribe(listener: () => void): () => void;
  isDisposed(): boolean;
  read(signal?: AbortSignal): Promise<T>;
  refresh(signal?: AbortSignal): Promise<T>;
}

const createProjection = <T>(
  host: GuestHost,
  owner: string,
  definition: WebviewCommandQueryDefinition,
  changed: () => void,
) => {
  const listeners = new Map<symbol, () => void>();
  const requests = createWebviewQueryRequests(host, owner, changed);
  let disposed = false;
  let membership: string | undefined;
  let stopEvents: (() => void) | undefined;
  let generation = -1;
  let version = -1;
  let publication = 0;
  let bridgeError = false;
  let snapshot: ScopedQuerySnapshot<T> = { data: undefined, loading: false, fetching: false };
  const current = () => !disposed && host.propsStore?.get().commandQueries?.owner === owner;
  const publish = () => runQueryCleanup([...listeners.values()]);
  const apply = (next: WebviewCommandQuerySnapshot) => {
    if (!current()) return;
    if (next.generation < generation) return;
    if (next.generation !== generation) {
      generation = next.generation;
      version = -1;
    }
    if (next.version < version || (next.version === version && !bridgeError)) return;
    bridgeError = false;
    publication++;
    version = next.version;
    const data = next.retired ? undefined : shareQueryValue(snapshot.data, next.data as T | undefined);
    snapshot = {
      data,
      loading: data === undefined && next.fetching,
      fetching: next.fetching,
      ...(next.error ? { error: new Error(next.error.message) } : {}),
    };
    if (next.retired) dispose();
    else publish();
  };
  const fail = (error: unknown) => {
    if (!current()) return;
    bridgeError = true;
    snapshot = {
      ...snapshot,
      loading: false,
      fetching: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
    publish();
  };
  const detach = () => {
    const previous = membership;
    membership = undefined;
    const stop = stopEvents;
    stopEvents = undefined;
    runQueryCleanup([
      () => stop?.(),
      () => {
        if (previous) requests.close(previous);
      },
      changed,
    ]);
  };
  const observe = () => {
    if (!current()) throw new Error("Command query authority is closed");
    const requestId = requests.begin();
    membership = requestId;
    const issued = publication;
    stopEvents = host.onEvent("commands.query", (payload) => {
      const event = payload as WebviewCommandQueryEvent;
      if (membership !== requestId || event.requestId !== requestId) return;
      apply(event.snapshot);
    });
    void host.call("commands.query", { ...definition, owner, requestId, operation: "observe" }).then(
      (next) => {
        if (membership !== requestId || !next) return;
        apply(next);
      },
      (error) => {
        if (membership === requestId && publication === issued) fail(error);
      },
    );
  };
  const read = async (operation: "read" | "refresh", signal?: AbortSignal) => {
    if (!current()) throw new Error("Command query authority is closed");
    return requests.read(definition, operation, signal, (next) => {
      signal?.throwIfAborted();
      if (!current() || !next) throw new Error("Command query authority is closed");
      apply(next);
      if (!current()) throw new Error("Command query authority is closed");
      if (snapshot.error) throw snapshot.error;
      return snapshot.data as T;
    });
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    snapshot = { data: undefined, loading: false, fetching: false };
    const notices = [...listeners.values()];
    listeners.clear();
    runQueryCleanup([detach, requests.dispose, ...notices]);
  };
  // Hydration is synchronous and runs once, before any observation or request can publish.
  const seed = host.propsStore
    ?.get()
    .commandQueries?.values.find((seed) => hashKey([seed.command]) === hashKey([definition.command]));
  if (seed && !seed.snapshot.retired) apply(seed.snapshot);
  return {
    getSnapshot: () => snapshot,
    isDisposed: () => disposed,
    read: (signal?: AbortSignal) => read("read", signal),
    refresh: (signal?: AbortSignal) => read("refresh", signal),
    active: () => listeners.size > 0 || requests.active(),
    dispose,
    subscribe(listener: () => void) {
      if (!current()) throw new Error("Command query authority is closed");
      const first = !listeners.size;
      const token = Symbol();
      listeners.set(token, listener);
      if (first) observe();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        listeners.delete(token);
        if (!listeners.size) detach();
      };
    },
  };
};

export const createWebviewCommandQueries = (host: GuestHost, extensionId: string) => {
  let closed = false;
  const entries = new Map<string, ReturnType<typeof createProjection<unknown>>>();
  const trim = () => {
    const inactive = [...entries].filter(([, query]) => !query.active());
    for (const [key, query] of inactive.slice(0, Math.max(0, inactive.length - 128))) {
      entries.delete(key);
      query.dispose();
    }
  };
  let authority = host.propsStore?.get().commandQueries?.owner;
  const clear = () => {
    const previous = [...entries.values()];
    entries.clear();
    runQueryCleanup(previous.map((entry) => entry.dispose));
  };
  const stop = host.propsStore?.subscribe(() => {
    const next = host.propsStore?.get().commandQueries?.owner;
    if (next === authority) return;
    authority = next;
    clear();
  });
  return {
    query<T>(
      command: WebviewCommandQueryDefinition["command"],
      options: WebviewCommandQueryOptions = {},
      eventOwner = extensionId,
    ) {
      if (closed) throw new Error("Command query authority is closed");
      const owner = host.propsStore?.get().commandQueries?.owner;
      if (!owner) throw new Error("The host does not support retained command queries");
      const resource = command.resource ?? host.propsStore?.get().resource;
      const definition = {
        command: { ...command, ...(resource ? { resource } : {}) },
        dependsOn: options.events?.map((event) => resolveEventReferenceId(event, eventOwner)),
        dependency: options.dependency,
      };
      const key = hashKey([owner, definition]);
      let entry = entries.get(key);
      if (!entry || entry.isDisposed()) {
        entry = createProjection(host, owner, structuredClone(definition), trim);
        entries.set(key, entry);
      }
      entries.delete(key);
      entries.set(key, entry);
      trim();
      return entry as WebviewCommandQuery<T>;
    },
    dispose() {
      closed = true;
      stop?.();
      clear();
    },
  };
};
