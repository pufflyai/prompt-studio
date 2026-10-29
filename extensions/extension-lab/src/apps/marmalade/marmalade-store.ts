import { createWebviewClient, type GuestHost, type PropsStore } from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import type { ExampleProps } from "../../view-context";
import type { MarmaladeAction, MarmaladeViewState } from "./marmalade.types";
import type { marmaladeCommands } from "./marmalade-commands";
import { createMarmaladeState } from "./marmalade-data";
import { marmaladeChanged } from "./marmalade-events";

export const createMarmaladeStore = () => {
  let state: MarmaladeViewState = { ...createMarmaladeState(), history: { undo: 0, redo: 0 } };
  let error = "";
  let snapshot = { state, error };
  const listeners = new Set<() => void>();
  let send: ((action: MarmaladeAction) => Promise<void>) | undefined;
  let pendingSelection: string[] | undefined;
  const publish = () => {
    snapshot = { state, error };
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async dispatch(action: MarmaladeAction) {
      if (send) await send(action);
    },
    connect(
      host: GuestHost,
      _props: PropsStore<ExampleProps>,
      onError: (error: unknown) => void,
      onReady?: () => void,
    ) {
      const client = createWebviewClient<typeof marmaladeCommands>(host);
      let active = true;
      let readId = 0;
      let queue = Promise.resolve();
      const refresh = async () => {
        const id = ++readId;
        try {
          const next = await client.commands["marmalade.read"]();
          if (!active || id !== readId) return;
          state = pendingSelection ? { ...next, selectedIds: pendingSelection } : next;
          publish();
          onReady?.();
        } catch (cause) {
          if (active) onError(cause);
        }
      };
      const unsubscribe = client.events.subscribe(marmaladeChanged, () => {
        void refresh();
      });
      const clearSelection = (action: MarmaladeAction) => {
        if (action.type === "select" && pendingSelection === action.ids) pendingSelection = undefined;
      };
      send = async (action) => {
        if (action.type === "select") {
          pendingSelection = action.ids;
          state = { ...state, selectedIds: action.ids };
        }
        try {
          error = "";
          publish();
          const command = queue.then(() => client.commands["marmalade.edit"]({ action }));
          queue = command.then(
            () => undefined,
            () => undefined,
          );
          await command;
          clearSelection(action);
          await refresh();
        } catch (cause) {
          if (active) {
            clearSelection(action);
            error = cause instanceof Error ? cause.message : String(cause);
            publish();
            await refresh();
          }
        }
      };
      void refresh();
      return () => {
        active = false;
        send = undefined;
        pendingSelection = undefined;
        unsubscribe();
      };
    },
  };
};
export const marmaladeStore = createMarmaladeStore();
export const useMarmalade = () =>
  useSyncExternalStore(marmaladeStore.subscribe, marmaladeStore.getSnapshot, marmaladeStore.getSnapshot);
