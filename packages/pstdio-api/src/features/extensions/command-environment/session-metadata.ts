import type { SessionMetadataChange } from "pstdio-api-contracts/extension-kernel";
import { apiLogger } from "../../../lib/logger";
import { observeSessionCommandsChanged } from "../../sessions/session-command-events";
import type { ExtensionsRouteDeps } from "../deps";
import { createSessionAccess, type SessionApiScope } from "./session-access";
import { closeSessionMetadata, waitForSessionMetadata } from "./session-metadata-lifetime";
import { observeSessionMetadataSources, readSessionMetadataScope } from "./session-metadata-sources";

type Listener = (change: SessionMetadataChange) => void;
interface Observation {
  listeners: Set<Listener>;
  ready: Promise<void>;
  close(): void;
  isClosed(): boolean;
}
const owners = new WeakMap<ExtensionsRouteDeps["sessionService"], Map<string, Observation>>();

const createObservation = (
  deps: ExtensionsRouteDeps,
  input: SessionApiScope,
  id: string,
  retire: () => void,
  previous?: Promise<void>,
) => {
  const listeners = new Set<Listener>();
  let active = true;
  let pending: Promise<void> | undefined;
  let dirty = false;
  let identity: string | undefined;
  let initialized = false;
  let workspaceId: string | undefined;
  const linkIds = new Set<string>();
  const stops: (() => void)[] = [];
  const notify = (change: SessionMetadataChange) => {
    if (!active) return;
    for (const listener of [...listeners]) {
      try {
        listener(change);
      } catch (err) {
        apiLogger.warn({ err, event: "session.metadata.observer_failed" }, "Session metadata observer failed");
      }
    }
  };
  const bind = async () => {
    const source = await readSessionMetadataScope(deps, input.projectId, id);
    if (!active) return;
    if (!source) {
      closeSessionMetadata(stops.splice(0));
      return;
    }
    workspaceId = source.workspaceId;
    linkIds.clear();
    for (const link of source.links) linkIds.add(link.id);
    if (source.identity === identity) return;
    identity = source.identity;
    try {
      closeSessionMetadata(stops.splice(0));
    } catch (err) {
      apiLogger.warn({ err, event: "session.metadata.cleanup_failed" }, "Session metadata cleanup failed");
    }
    await observeSessionMetadataSources(
      deps,
      input.projectId,
      id,
      source,
      notify,
      (stop) => {
        if (active) {
          stops.push(stop);
          return true;
        }
        stop();
        return false;
      },
      () => active,
    );
    if (initialized) {
      // A handoff may outlive a finite read. Reconcile again after its actual source is subscribed.
      notify("harness");
      notify("workspace");
      if (!source.local) notify("execution");
    }
    initialized = true;
  };
  const rebind = () => {
    dirty = true;
    if (pending) return pending;
    pending = (async () => {
      if (previous) await previous.catch(() => {});
      while (dirty && active) {
        dirty = false;
        await bind();
      }
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  };
  // These cheap marks are installed before resolving the current session, link and provider.
  const stopRows = deps.eventBus.subscribe((event) => {
    const row = event.data as { id?: string; session_id?: string; workspace_id?: string };
    if (event.table === "sessions" && row.id === id) {
      notify("session");
      void rebind().catch(() => notify("session"));
    } else if (event.table === "workspace_sessions" && (row.session_id === id || (row.id && linkIds.has(row.id)))) {
      if (row.id) {
        if (event.op === "delete") linkIds.delete(row.id);
        else linkIds.add(row.id);
      }
      notify("session");
      void rebind().catch(() => notify("session"));
    } else if (event.table === "workspaces" && row.id === workspaceId) {
      notify("workspace");
      void rebind().catch(() => notify("session"));
    }
  });
  const stopCommands = observeSessionCommandsChanged(deps.eventBus, id, () => notify("harness"));
  const stopCatalog = deps.extensionRuntimeCatalog.subscribeInvalidation((change) => {
    if (change.reason === "webviews_built") return;
    if (change.projectId && change.projectId !== input.projectId) return;
    identity = undefined;
    notify("harness");
    void rebind().catch(() => notify("session"));
  });
  const ready = rebind();
  return {
    listeners,
    get ready() {
      return pending ?? ready;
    },
    isClosed: () => !active,
    close() {
      if (!active) return;
      active = false;
      closeSessionMetadata([
        stopRows,
        stopCommands,
        stopCatalog,
        ...stops.splice(0),
        () => listeners.clear(),
        // Keep an actual installation barrier for a replacement of this same identity.
        () => {
          void (pending ?? ready).then(retire, retire);
        },
      ]);
    },
  };
};

export const observeSessionMetadata = async (
  deps: ExtensionsRouteDeps,
  input: SessionApiScope,
  id: string,
  changed: Listener,
  signal?: AbortSignal,
) => {
  input.signal?.throwIfAborted();
  signal?.throwIfAborted();
  await createSessionAccess(deps, input).requireReadableSession(id);
  input.signal?.throwIfAborted();
  signal?.throwIfAborted();
  let entries = owners.get(deps.sessionService);
  if (!entries) {
    entries = new Map();
    owners.set(deps.sessionService, entries);
  }
  const key = JSON.stringify([input.projectId, id]);
  let entry = entries.get(key);
  if (!entry || entry.isClosed()) {
    const created = createObservation(
      deps,
      input,
      id,
      () => {
        if (entries.get(key) === created) entries.delete(key);
      },
      entry?.ready,
    );
    entry = created;
    entries.set(key, created);
  }
  const held = entry;
  const token: Listener = (change) => changed(change);
  held.listeners.add(token);
  let closed = false;
  const lifetime = new AbortController();
  const close = () => {
    if (closed) return;
    closed = true;
    lifetime.abort(new DOMException("Session metadata observation closed", "AbortError"));
    held.listeners.delete(token);
    input.signal?.removeEventListener("abort", abort);
    signal?.removeEventListener("abort", abort);
    if (!held.listeners.size) held.close();
  };
  const abort = () => {
    try {
      close();
    } catch (err) {
      apiLogger.warn({ err, event: "session.metadata.cleanup_failed" }, "Session metadata cleanup failed");
    }
  };
  input.signal?.addEventListener("abort", abort, { once: true });
  signal?.addEventListener("abort", abort, { once: true });
  input.scope?.register(close);
  try {
    await waitForSessionMetadata(held.ready, [input.signal, signal, lifetime.signal]);
    if (input.signal?.aborted || signal?.aborted) close();
    return { close };
  } catch (error) {
    close();
    throw error;
  }
};
