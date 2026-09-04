import { useSyncExternalStore } from "react";
import type { ResourceRef, WorkbenchCore } from "../../core";

export interface ShowcaseStore<State> {
  getState(): State;
  setState(update: Partial<State> | ((state: State) => State)): void;
  subscribe(listener: () => void): () => void;
}

export const createShowcaseStore = <State extends object>(initialState: State): ShowcaseStore<State> => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState(update) {
      state = typeof update === "function" ? update(state) : { ...state, ...update };
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export const useShowcaseStore = <State extends object>(store: ShowcaseStore<State>) =>
  useSyncExternalStore(store.subscribe, store.getState, store.getState);

export const usePrimaryResource = (workbench: WorkbenchCore) =>
  useSyncExternalStore<ResourceRef | undefined>(
    (listener) => {
      const disposable = workbench.onDidChangePrimaryResource(listener);
      return () => disposable.dispose();
    },
    () => workbench.getPrimaryResource(),
    () => workbench.getPrimaryResource(),
  );

export const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
