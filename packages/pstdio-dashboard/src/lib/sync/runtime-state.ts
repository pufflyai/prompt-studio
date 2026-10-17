import { getRuntimeCollections, type RuntimeCollections } from "./collections";

export const createRuntimeState = <T>(create: () => T, dispose?: (state: T) => void) => {
  const states = new WeakMap<RuntimeCollections, T>();
  return (owner = getRuntimeCollections()) => {
    let state = states.get(owner);
    if (state === undefined) {
      state = create();
      const owned = state;
      states.set(owner, state);
      owner.onDispose(() => {
        dispose?.(owned);
        states.delete(owner);
      });
    }
    return state;
  };
};

export const createRuntimeFeed = <T>() => {
  const listeners = createRuntimeState(
    () => new Set<(event: T) => void>(),
    (state) => state.clear(),
  );
  return {
    subscribe: (listener: (event: T) => void, owner = getRuntimeCollections()) => {
      const subscriptions = listeners(owner);
      subscriptions.add(listener);
      return () => {
        subscriptions.delete(listener);
      };
    },
    publish: (event: T, owner = getRuntimeCollections()) => {
      if (owner.isDisposed()) return;
      for (const listener of listeners(owner)) listener(event);
    },
  };
};
