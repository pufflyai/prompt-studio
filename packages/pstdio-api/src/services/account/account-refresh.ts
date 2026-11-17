/** Serializes membership refreshes with local recovery publications. */
export const createAccountRefresh = (input: {
  load: () => Promise<void>;
  publish: () => Promise<void>;
  failed: (error: unknown) => void;
}) => {
  let running = Promise.resolve();
  let queued: Promise<void> | undefined;
  return {
    // Calls that arrive while a membership refresh waits to start share it.
    refresh() {
      if (queued) return queued;
      const next = running
        .then(() => {
          queued = undefined;
          return input.load();
        })
        .catch(input.failed);
      queued = next;
      running = next;
      return next;
    },
    changed() {
      running = running.then(input.publish).catch(input.failed);
      return running;
    },
    done: () => running,
  };
};
