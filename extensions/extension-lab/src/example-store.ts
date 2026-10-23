import {
  createWebviewClient,
  diffEditingState,
  type GuestHost,
  type WebviewEditingSession,
} from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import type { commands } from "./state-commands";
import type { ExampleName } from "./state-defaults";
import { examplesChanged } from "./state-events";

export { usePageResource } from "./view-context";

const changedRoots = <State extends object>(before: State, after: State) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => JSON.stringify(before[key as keyof State]) !== JSON.stringify(after[key as keyof State]),
  );

export const createExampleStore = <State extends object>(name: ExampleName, initial: State) => {
  let state = structuredClone(initial);
  let previousShared = initial;
  let transient: Partial<State> = {};
  let session: WebviewEditingSession<State> | undefined;
  let onError = (_error: unknown) => {};
  const listeners = new Set<() => void>();
  const publish = () => {
    const shared = session?.getSnapshot().value ?? initial;
    for (const key of changedRoots(previousShared, shared)) delete transient[key as keyof State];
    previousShared = shared;
    state = { ...shared, ...transient };
    for (const listener of listeners) listener();
  };
  const edit = (update: Partial<State> | ((state: State) => State), preview: boolean) => {
    if (!session) throw new Error("Example editing session is not ready");
    const next = typeof update === "function" ? update(state) : { ...state, ...update };
    const keys = typeof update === "function" ? changedRoots(state, next) : Object.keys(update);
    const durable = { ...session.getSnapshot().value };
    for (const key of keys) {
      delete transient[key as keyof State];
      if (Object.hasOwn(next, key)) durable[key as keyof State] = next[key as keyof State];
      else delete durable[key as keyof State];
    }
    const changes = diffEditingState(session.getSnapshot().value, durable);
    return (preview ? session.preview(changes) : session.commit(changes)).catch(onError);
  };
  return {
    getState: () => state,
    getPendingCount: () => {
      const snapshot = session?.getSnapshot();
      return snapshot && snapshot.revision > snapshot.savedRevision ? 1 : 0;
    },
    setState: (update: Partial<State> | ((state: State) => State)) => edit(update, false),
    preview: (update: Partial<State> | ((state: State) => State)) => edit(update, true),
    commitPreview: () => session?.commit().catch(onError),
    cancelPreview: () => session?.cancel().catch(onError),
    setTransient(update: Partial<State>) {
      transient = { ...transient, ...update };
      publish();
    },
    clearTransient(...keys: (keyof State)[]) {
      if (!keys.some((key) => Object.hasOwn(transient, key))) return;
      for (const key of keys) delete transient[key];
      publish();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect(host: GuestHost, handleError: (error: unknown) => void, onReady?: () => void) {
      const client = createWebviewClient<typeof commands>(host);
      let active = true;
      let connected: WebviewEditingSession<State> | undefined;
      let unsubscribe = () => {};
      onError = handleError;
      const read = async () => (await client.commands["state.read"]({ name })).state as State;
      const ready = read()
        .then(async (value) => {
          connected = await client.editing.open({
            key: name,
            initial: value,
            save: { commandId: `${host.extensionId}.command.state.update`, params: { name } },
          });
          if (!active) {
            await connected.close();
            return;
          }
          session = connected;
          transient = {};
          unsubscribe = connected.subscribe(publish);
          publish();
          onReady?.();
        })
        .catch((error: unknown) => {
          if (active) handleError(error);
        });
      const events = client.events.subscribe(examplesChanged, () => {
        void ready
          .then(async () => {
            if (active) await connected?.refresh(read);
          })
          .catch(handleError);
      });
      return () => {
        active = false;
        events();
        unsubscribe();
        if (session === connected) session = undefined;
        void connected?.close().catch(handleError);
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
