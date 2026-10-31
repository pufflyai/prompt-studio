import {
  applyEditingChanges,
  createWebviewClient,
  type GuestHost,
  type WebviewEditingChange,
} from "@pstdio/sdk/extensions";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "../../extensions/bridge/webview-host-capabilities";

const initialDocument = { title: "Original title", position: { x: 0, y: 0 } };
export type EditingDocument = typeof initialDocument;

// Only persistence and transport are in memory. The SDK, capability gate, event
// publisher, host-owned documents and save queue are the production implementations.
export const createEditingSessionsFixture = () => {
  const workbench = createWorkbench();
  const extensionId = "preview.editing";
  const commandId = `${extensionId}.command.save`;
  const listeners = new Set<() => void>();
  const waiting = new Set<{ resolve(): void; reject(error: Error): void }>();
  let state = {
    held: true,
    started: 0,
    completed: 0,
    waiting: 0,
    saved: { main: structuredClone(initialDocument), other: structuredClone(initialDocument) },
  };
  const update = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch, waiting: waiting.size };
    for (const listener of listeners) listener();
  };
  const release = () => {
    for (const save of waiting) save.resolve();
    waiting.clear();
    update({ held: false });
  };
  workbench.commands.registerCommand(
    { id: commandId, label: "Save editing document" },
    {
      execute: async (params) => {
        const { document, changes } = params as { document: "main" | "other"; changes: WebviewEditingChange[] };
        update({ started: state.started + 1 });
        if (state.held) {
          await new Promise<void>((resolve, reject) => {
            waiting.add({ resolve, reject });
            update({});
          });
        }
        update({
          completed: state.completed + 1,
          saved: { ...state.saved, [document]: applyEditingChanges(state.saved[document], changes) },
        });
      },
    },
  );
  const open = async (document: "main" | "other") => {
    const events = createHostEventPublisher();
    const handlers = new Map<string, Set<(payload: unknown) => void>>();
    events.bind(({ scope, payload }) => {
      for (const handler of handlers.get(scope) ?? []) handler(payload);
    });
    const gate = createHostCapabilityGate({
      declaredCapabilities: ["editing.session"],
      capabilities: createWorkbenchWebviewHostCapabilities({
        workbench,
        extensionId,
        projectId: "editing-story",
        hostEvents: events,
      }),
    });
    const host: GuestHost = {
      extensionId,
      call: async (method, ...[params]) => (await gate.call({ method, params })) as never,
      onEvent: (scope, handler) => {
        const scoped = handlers.get(scope) ?? new Set();
        handlers.set(scope, scoped);
        scoped.add(handler);
        return () => {
          scoped.delete(handler);
        };
      },
    };
    return createWebviewClient(host).editing.open({
      key: document,
      initial: structuredClone(state.saved[document]),
      save: { commandId, params: { document } },
    });
  };
  return {
    open,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hold: () => update({ held: true }),
    release,
    fail: () => {
      for (const save of waiting) save.reject(new Error("Save failed. Your edit is still shared. Retry saving."));
      waiting.clear();
      update({});
    },
  };
};

export type EditingSessionsFixture = ReturnType<typeof createEditingSessionsFixture>;
