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

export type EditingSnapshot<State extends object> = Omit<WebviewEditingSnapshot, "value"> & { value: State };
export type EditingSessionOptions<State extends object> = Pick<
  Extract<WebviewEditingSessionParams, { operation: "open" }>,
  "key" | "save"
> & { initial: State };

export interface WebviewEditingSession<State extends object> {
  readonly id: string;
  getSnapshot(): EditingSnapshot<State>;
  subscribe(listener: () => void): () => void;
  /** Publish immediately; resolve when the shared save queue acknowledges this edit. */
  commit(changes?: WebviewEditingChange[]): Promise<void>;
  /** Add draft changes visible in all views without saving them. */
  preview(changes: WebviewEditingChange[]): Promise<void>;
  cancel(): Promise<void>;
  /** Retry or await the current save queue. */
  save(): Promise<void>;
  /** Re-read the backend when shared state changes while a read is in flight. */
  refresh(read: () => Promise<State>): Promise<void>;
  close(): Promise<void>;
}

export interface WebviewEditingClient {
  open<State extends object>(options: EditingSessionOptions<State>): Promise<WebviewEditingSession<State>>;
}

export const createWebviewEditingClient = (host: GuestHost) =>
  ({
    async open<State extends object>(options: EditingSessionOptions<State>) {
      const sessionId = crypto.randomUUID();
      const listeners = new Set<() => void>();
      const pending = new Map<number, WebviewEditingChange[]>();
      let sequence = 0;
      let active = true;
      let base: WebviewEditingSnapshot = {
        value: options.initial as JsonObject,
        version: -1,
        revision: 0,
        savedRevision: 0,
      };
      let current = base as EditingSnapshot<State>;
      const publish = () => {
        current = {
          ...base,
          value: rebaseEditingChanges(base.value, pending).value as State,
        };
        for (const listener of listeners) listener();
      };
      const acknowledge = (sequence: number | undefined) => {
        if (sequence === undefined) return;
        for (const key of pending.keys()) if (key <= sequence) pending.delete(key);
      };
      const accept = (next: WebviewEditingSnapshot, appliedSequence?: number) => {
        if (!active) return;
        const size = pending.size;
        acknowledge(appliedSequence);
        if (next.version >= base.version) base = next;
        else if (size === pending.size) return;
        publish();
      };
      const unsubscribe = host.onEvent("editing.session", (payload) => {
        const event = payload as WebviewEditingSessionEvent;
        if (event.sessionId === sessionId) accept(event.snapshot, event.appliedSequence);
      });
      const request = async (input: WebviewEditingSessionParams) => {
        if (!active) throw new Error("editing_session_closed");
        const result = await host.call("editing.session", input);
        if (result) accept(result);
        return result;
      };
      const edit = async (operation: "commit" | "preview", changes: WebviewEditingChange[]) => {
        if (!active) throw new Error("editing_session_closed");
        applyEditingChanges(current.value, changes);
        const next = ++sequence;
        pending.set(next, structuredClone(changes));
        publish();
        try {
          await request({ operation, sessionId, sequence: next, changes });
        } catch (error) {
          if (pending.delete(next)) publish();
          throw error;
        }
      };
      try {
        await request({ operation: "open", sessionId, ...options, initial: options.initial as JsonObject });
      } catch (error) {
        active = false;
        unsubscribe();
        throw error;
      }
      return {
        id: sessionId,
        getSnapshot: () => current,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        commit: (changes = []) => edit("commit", changes),
        preview: (changes) => edit("preview", changes),
        async cancel() {
          await request({ operation: "cancel", sessionId });
        },
        async save() {
          await request({ operation: "save", sessionId });
        },
        async refresh(read) {
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
          unsubscribe();
          listeners.clear();
          await host.call("editing.session", { operation: "close", sessionId });
        },
      } satisfies WebviewEditingSession<State>;
    },
  }) satisfies WebviewEditingClient;
