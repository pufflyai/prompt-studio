const owners = new WeakMap<object, Map<string, Promise<void>>>();
const defaultOwner = {};

// Keep a controller's requested writes together when its editor is rebound.
export const acquireFileSaveTurn = (key: string, owner = defaultOwner) => {
  let queue = owners.get(owner);
  if (!queue) {
    queue = new Map();
    owners.set(owner, queue);
  }
  const saves = queue;
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
