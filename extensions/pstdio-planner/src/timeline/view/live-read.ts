interface LiveReadHandlers<T> {
  onValue(value: T): void;
  onError(error: unknown): void;
}

// An event during a read invalidates its result and requests one newer snapshot.
export function createLiveRead<T>(read: () => Promise<T>, handlers: LiveReadHandlers<T>) {
  let active = true;
  let reading = false;
  let pending = false;
  return {
    async refresh() {
      pending = true;
      if (reading || !active) return;
      reading = true;
      try {
        while (active && pending) {
          pending = false;
          try {
            const value = await read();
            if (active && !pending) handlers.onValue(value);
          } catch (error) {
            if (active && !pending) handlers.onError(error);
          }
        }
      } finally {
        reading = false;
      }
    },
    dispose() {
      active = false;
    },
  };
}
