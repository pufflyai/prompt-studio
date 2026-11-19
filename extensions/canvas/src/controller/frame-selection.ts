import { createStore } from "zustand/vanilla";

export const createFrameSelection = (ids: readonly string[]) => {
  const sourceIds = new Set(ids);
  const state = createStore<{ selected?: string }>(() => ({}));
  const releases = new Set<() => void>();
  let disposed = false;
  return {
    get: () => state.getState().selected,
    select: (id?: string) => {
      if (disposed || (id !== undefined && !sourceIds.has(id)) || state.getState().selected === id) return;
      state.setState({ selected: id });
    },
    subscribe: (listener: () => void) => {
      if (disposed) return () => {};
      const stop = state.subscribe(listener);
      releases.add(stop);
      return () => {
        releases.delete(stop);
        stop();
      };
    },
    dispose: () => {
      disposed = true;
      for (const stop of releases) stop();
      releases.clear();
      state.setState({ selected: undefined });
    },
  };
};
