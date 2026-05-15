import { useStore } from "zustand";
import type { ShellStore } from "../../core";

export const useShellStore = <TState, TSlice>(store: ShellStore<TState>, selector: (state: TState) => TSlice) =>
  useStore(store, selector);
