interface LiveReadHandlers<T> {
  onValue(value: T): void;
  onError(error: unknown): void;
}

// An event during a read invalidates its result and requests one newer snapshot.
export function createLiveRead<T>(read: () => Promise<T>, handlers: LiveReadHandlers<T>) {
  let active = true;
  let reading = false;
  let pending = false;
  let immediate = false;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (scheduled || !active) return;
    scheduled = setTimeout(() => {
      scheduled = undefined;
      void drain();
    }, 100);
  };
  const readCurrent = async () => {
    try {
      const value = await read();
      if (active && !pending) handlers.onValue(value);
    } catch (error) {
      if (active && !pending) handlers.onError(error);
    }
  };
  const drain = async () => {
    if (reading || !active) return;
    reading = true;
    try {
      while (active && pending && !scheduled) {
        pending = false;
        immediate = false;
        await readCurrent();
        // A slow read must yield before another background read; its original
        // timer may otherwise expire while the read still owns the host queue.
        if (pending && !immediate) schedule();
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
      immediate = true;
      return drain();
    },
    invalidate() {
      if (!active) return;
      // Identity, record and domain notifications can describe one committed action.
      // Mark its snapshot obsolete now and batch notifications without extending the deadline.
      pending = true;
      if (!reading) schedule();
    },
    dispose() {
      active = false;
      clearTimeout(scheduled);
    },
  };
}
