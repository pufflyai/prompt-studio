import { useStore } from "zustand";
import type { WorkbenchStore } from "../../core";

export const useWorkbenchStore = <TState, TSlice>(store: WorkbenchStore<TState>, selector: (state: TState) => TSlice) =>
  useStore(store, selector);
