interface LiveReadHandlers<T> {
  onValue(value: T): void;
  onError(error: unknown): void;
}

// An event during a read invalidates its result and requests one newer snapshot.
export function createLiveRead<T>(read: () => Promise<T>, handlers: LiveReadHandlers<T>) {
  let active = true;
  let reading = false;
  let pending = false;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const drain = async () => {
    if (reading || !active) return;
    reading = true;
    try {
      while (active && pending && !scheduled) {
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
  };
  return {
    refresh() {
      clearTimeout(scheduled);
      scheduled = undefined;
      pending = true;
      return drain();
    },
    invalidate() {
      if (!active) return;
      // Identity, record and domain notifications can describe one committed action.
      // Mark its snapshot obsolete now and batch notifications without extending the deadline.
      pending = true;
      if (scheduled) return;
      scheduled = setTimeout(() => {
        scheduled = undefined;
        void drain();
      }, 100);
    },
    dispose() {
      active = false;
      clearTimeout(scheduled);
    },
  };
}
