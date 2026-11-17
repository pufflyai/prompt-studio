import {
  applyEditingChanges,
  type JsonObject,
  rebaseEditingChanges,
  type WebviewEditingChange,
  type WebviewEditingSessionEvent,
  type WebviewEditingSessionParams,
  type WebviewEditingSnapshot,
} from "pstdio-api-contracts/extension-kernel";
import type { GuestHost } from "./guest-host";
import type { EditingCommandOptions, EditingSnapshot } from "./webview-editing";
import { createEditingPreviewQueue, mergeEditingPreview } from "./webview-editing-preview";

type Open =
  | Omit<Extract<WebviewEditingSessionParams, { operation: "open" }>, "sessionId">
  | Omit<Extract<WebviewEditingSessionParams, { operation: "open-command" }>, "sessionId">;

export const openEditingSession = async <State extends object>(host: GuestHost, open: Open) => {
  const sessionId = crypto.randomUUID();
  const listeners = new Set<() => void>();
  const pending = new Map<number, { changes: WebviewEditingChange[]; draft: boolean }>();
  let sequence = 0;
  let previewIntent: WebviewEditingChange[] = [];
  let active = true;
  let base: WebviewEditingSnapshot = {
    value: open.operation === "open" ? open.initial : {},
    version: -1,
    revision: 0,
    savedRevision: 0,
  };
  let current = base as EditingSnapshot<State>;
  const publish = () => {
    current = {
      ...base,
      value: rebaseEditingChanges(base.value, new Map([...pending].map(([key, value]) => [key, value.changes])))
        .value as State,
      ...(open.operation === "open-command"
        ? { hasDrafts: base.hasDrafts || [...pending.values()].some((value) => value.draft) }
        : {}),
    };
    for (const listener of listeners) listener();
  };
  const prunePreview = () => {
    if (!previewIntent.length || rebaseEditingChanges(base.value, new Map([[0, previewIntent]])).drafts.size) return;
    previewIntent = [];
    previews.clear();
  };
  const accept = (next: WebviewEditingSnapshot, appliedSequence?: number) => {
    if (!active) return;
    if (next.retired) {
      active = false;
      pending.clear();
      previewIntent = [];
      previews.dispose();
      base = next;
      unsubscribe();
      publish();
      listeners.clear();
      return;
    }
    const size = pending.size;
    // Optional previews may arrive before an older required command has reached the host.
    if (appliedSequence !== undefined) pending.delete(appliedSequence);
    if (next.version >= base.version) {
      base = next;
      prunePreview();
    } else if (size === pending.size) return;
    publish();
  };
  const unsubscribe = host.onEvent("editing.session", (payload) => {
    const event = payload as WebviewEditingSessionEvent;
    if (event.sessionId === sessionId) accept(event.snapshot, event.appliedSequence);
  });
  const request = async (input: WebviewEditingSessionParams) => {
    if (!active) throw new Error("editing_session_closed");
    const result = await host.call("editing.session", input);
    if (result) accept(result, "sequence" in input ? input.sequence : undefined);
    if (!active) throw new Error("editing_session_closed");
    return result;
  };
  const previews = createEditingPreviewQueue(
    async (input: Extract<WebviewEditingSessionParams, { operation: "preview" | "commit" }>) => {
      await request(input);
    },
  );
  const dropDraftOptimism = () => {
    for (const [key, entry] of pending) if (entry.draft) pending.delete(key);
  };
  const clearPreview = () => {
    previews.clear();
    previewIntent = [];
    dropDraftOptimism();
  };
  const edit = async (
    operation: "commit" | "preview" | "execute",
    changes: WebviewEditingChange[],
    params: JsonObject = {},
    channel?: EditingCommandOptions["channel"],
  ) => {
    if (!active) throw new Error("editing_session_closed");
    const combined = mergeEditingPreview(previewIntent, changes);
    applyEditingChanges(current.value, combined);
    if (operation === "preview") {
      previewIntent = combined;
      dropDraftOptimism();
    } else clearPreview();
    const next = ++sequence;
    pending.set(next, { changes: combined, draft: operation === "preview" });
    publish();
    try {
      if (operation === "preview") await previews.enqueue({ operation, sessionId, sequence: next, changes: combined });
      else if (operation === "execute")
        await request({ operation, sessionId, sequence: next, changes: combined, params, channel });
      else await request({ operation, sessionId, sequence: next, changes: combined });
    } catch (error) {
      if (pending.delete(next)) publish();
      if (operation === "preview" && next < sequence) return;
      throw error;
    }
  };
  try {
    await request({ ...open, sessionId });
  } catch (error) {
    active = false;
    unsubscribe();
    throw error;
  }
  return {
    id: sessionId,
    getSnapshot: () => current,
    subscribe(listener: () => void) {
      if (!active) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    commit: (changes: WebviewEditingChange[] = []) => edit("commit", changes),
    execute: (params: JsonObject, options: EditingCommandOptions = {}) =>
      edit("execute", options.changes ?? [], params, options.channel),
    preview: (changes: WebviewEditingChange[]) => edit("preview", changes),
    async cancel() {
      clearPreview();
      publish();
      await request({ operation: "cancel", sessionId, sequence: ++sequence });
    },
    async save() {
      await request({ operation: "save", sessionId });
    },
    async refresh(read: () => Promise<State>) {
      while (active) {
        await request({ operation: "save", sessionId });
        const expectedVersion = base.version;
        const value = await read();
        if (
          !active ||
          (await request({ operation: "refresh", sessionId, value: value as JsonObject, expectedVersion }))
        )
          return;
      }
    },
    async close() {
      if (!active) return;
      active = false;
      previews.dispose();
      previewIntent = [];
      pending.clear();
      unsubscribe();
      listeners.clear();
      await host.call("editing.session", { operation: "close", sessionId });
    },
  };
};
