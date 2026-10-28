const saves = new Map<string, Promise<void>>();

// Keep a controller's requested writes together when its editor is rebound.
export const acquireFileSaveTurn = (key: string) => {
  const ready = saves.get(key);
  const complete = Promise.withResolvers<void>();
  saves.set(key, complete.promise);
  return {
    ready,
    release() {
      complete.resolve();
      if (saves.get(key) === complete.promise) saves.delete(key);
    },
  };
};
