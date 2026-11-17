/** Keep accepted writes ordered per value, while unrelated scopes remain independent. */
export const createPreferenceWrites = () => {
  const pending = new Map<string, Promise<void>>();
  const acceptedJobs = new Set<Promise<void>>();
  let closed = false;
  return {
    write(key: string, operation: () => void | Promise<void>, accepted: () => void) {
      if (closed) throw new Error("Preference registry is disposed");
      if (acceptedJobs.size >= 128) throw new Error("Too many pending preference writes");
      const previous = pending.get(key);
      const result = previous ? previous.catch(() => {}).then(operation) : operation();
      if (!result) {
        accepted();
        return;
      }
      const settled = Promise.resolve(result)
        .then(accepted)
        .finally(() => {
          acceptedJobs.delete(settled);
          if (pending.get(key) === settled) pending.delete(key);
        });
      pending.set(key, settled);
      acceptedJobs.add(settled);
      return settled;
    },
    close() {
      closed = true;
      return Promise.allSettled([...acceptedJobs]).then((results) => {
        for (const result of results) if (result.status === "rejected") throw result.reason;
      });
    },
  };
};
