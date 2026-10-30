export const createFrameSelection = (ids: readonly string[]) => {
  const sourceIds = new Set(ids);
  const listeners = new Set<() => void>();
  let selected: string | undefined;
  return {
    get: () => selected,
    select: (id?: string) => {
      if ((id !== undefined && !sourceIds.has(id)) || selected === id) return;
      selected = id;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      selected = undefined;
      listeners.clear();
    },
  };
};
