import { createWebviewClient, type GuestHost, type PropsStore } from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import { applyStateChanges, type StateChange, stateChanges } from "./state-changes";
import type { commands } from "./state-commands";
import type { ExampleName } from "./state-defaults";
import { examplesChanged } from "./state-events";
import type { ExampleProps } from "./view-context";

export { usePageResource } from "./view-context";

export const createExampleStore = <State extends object>(name: ExampleName, initial: State) => {
  let state = structuredClone(initial);
  const listeners = new Set<() => void>();
  const pending: StateChange[][] = [];
  let write: ((changes: StateChange[]) => Promise<void>) | undefined;
  const publish = (next: State) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    getState: () => state,
    getPendingCount: () => pending.length,
    setState(update: Partial<State> | ((state: State) => State)) {
      const next = typeof update === "function" ? update(state) : { ...state, ...update };
      const changes = stateChanges(state, next);
      publish(next);
      if (changes.length) return write?.(changes);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect(
      host: GuestHost,
      _props: PropsStore<ExampleProps>,
      onError: (error: unknown) => void,
      onReady?: () => void,
    ) {
      const client = createWebviewClient<typeof commands>(host);
      let active = true;
      let generation = 0;
      let queue = Promise.resolve();
      const accept = (result: unknown) => {
        if (!active) return;
        const snapshot = result as { name: string; state: State };
        if (snapshot?.name !== name) return;
        publish(applyStateChanges(snapshot.state, pending.flat()));
      };
      publish(structuredClone(initial));
      const refresh = async () => {
        const request = ++generation;
        const result = await client.commands["state.read"]({ name });
        if (request === generation) accept(result);
      };
      const unsubscribe = client.events.subscribe(examplesChanged, () => {
        void refresh().catch(onError);
      });
      const ready = refresh()
        .then(() => {
          if (active) onReady?.();
        })
        .catch(onError);
      write = (changes) => {
        pending.push(changes);
        for (const listener of listeners) listener();
        queue = queue
          .then(() => ready)
          .then(async () => {
            await client.commands["state.update"]({ name, changes });
            pending.shift();
            // The command's captured result can predate another view's completed write.
            await refresh();
          })
          .catch(onError);
        return queue;
      };
      return () => {
        active = false;
        write = undefined;
        unsubscribe();
      };
    },
  };
};
export const useExampleStore = <State extends object>(store: {
  subscribe(listener: () => void): () => void;
  getState(): State;
}) => useSyncExternalStore(store.subscribe, store.getState, store.getState);
export const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
