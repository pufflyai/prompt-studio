export const createSessionQueueLifecycle = () => {
  const pending = new Set<Promise<void>>();
  let closing = false;

  return {
    run(operation: () => Promise<void>) {
      if (closing) return Promise.resolve();
      const task = operation();
      pending.add(task);
      void task.then(
        () => pending.delete(task),
        () => pending.delete(task),
      );
      return task;
    },
    async close() {
      // New work stays in the durable queue for the next app instance.
      closing = true;
      await Promise.allSettled(pending);
    },
  };
};
