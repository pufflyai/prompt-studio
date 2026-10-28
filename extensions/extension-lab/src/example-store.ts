import {
  createWebviewClient,
  diffEditingState,
  type GuestHost,
  type PropsStore,
  type WebviewEditingSession,
} from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import type { commands } from "./state-commands";
import type { ExampleName } from "./state-defaults";
import { examplesChanged } from "./state-events";
import type { ExampleProps } from "./view-context";

export { usePageResource } from "./view-context";

export const createExampleStore = <State extends object>(name: ExampleName, initial: State) => {
  let session: WebviewEditingSession<State> | undefined;
  const listeners = new Set<() => void>();
  let onError: (error: unknown) => void = () => {};
  const getState = () => session?.getSnapshot().value ?? initial;
  return {
    getState,
    getPendingCount: () => {
      const snapshot = session?.getSnapshot();
      return snapshot ? snapshot.revision - snapshot.savedRevision : 0;
    },
    setState(update: Partial<State> | ((state: State) => State)) {
      const state = getState();
      const next = typeof update === "function" ? update(state) : { ...state, ...update };
      const changes = diffEditingState(state, next);
      if (changes.length) return session?.commit(changes).catch(onError);
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
      reportError: (error: unknown) => void,
      onReady?: () => void,
    ) {
      const client = createWebviewClient<typeof commands>(host);
      onError = reportError;
      let active = true;
      let connection: WebviewEditingSession<State> | undefined;
      let unsubscribeSession = () => {};
      const read = async () => (await client.commands["state.read"]({ name })).state as State;
      const ready = (async () => {
        const opened = await client.editing.open({
          key: `example:${name}`,
          initial: await read(),
          save: { commandId: `${host.extensionId}.command.state.update`, params: { name } },
        });
        if (!active) return opened.close();
        session = connection = opened;
        unsubscribeSession = opened.subscribe(() => {
          for (const listener of listeners) listener();
        });
        for (const listener of listeners) listener();
        onReady?.();
      })();
      void ready.catch(onError);
      const unsubscribe = client.events.subscribe(examplesChanged, () => {
        void ready
          .then(() => {
            if (active) return connection?.refresh(read);
          })
          .catch(onError);
      });
      return () => {
        active = false;
        unsubscribe();
        unsubscribeSession();
        if (session === connection) session = undefined;
        void connection?.close().catch(onError);
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
