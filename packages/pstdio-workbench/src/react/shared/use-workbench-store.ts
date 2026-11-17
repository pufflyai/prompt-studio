import { useStore } from "zustand";
import type { WorkbenchStore } from "../../core";

export const useWorkbenchStore = <TState, TSlice>(store: WorkbenchStore<TState>, selector: (state: TState) => TSlice) =>
  useStore(store, selector);

const emptyStore = {
  getState: () => undefined,
  getInitialState: () => undefined,
  subscribe: () => () => {},
};

/** An absent view has no input owner; keep hook order without observing another view's state. */
export const useOptionalWorkbenchStore = <TState, TSlice>(
  store: WorkbenchStore<TState> | undefined,
  selector: (state: TState) => TSlice,
) => useStore(store ?? emptyStore, (state: TState | undefined) => (state === undefined ? undefined : selector(state)));
